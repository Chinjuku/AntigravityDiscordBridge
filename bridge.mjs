import {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
    SlashCommandBuilder
} from 'discord.js';
import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PORT = process.env.PORT || 4321;
const PROJECTS_FILE = path.join(__dirname, 'projects.json');

// -------------------------------------------------------------
// Color Palette (Discord Embed Colors)
// -------------------------------------------------------------
const COLORS = {
    QUESTION: 0x5865F2,  // Blurple
    ANSWERED: 0x57F287,  // Bright Green
    STARTED: 0xF59E0B,   // Amber / Orange
    PROGRESS: 0x3B82F6,  // Blue
    COMPLETED: 0x10B981, // Emerald Green
    FAILED: 0xED4245,    // Red
    INFO: 0x8B5CF6       // Purple
};

// -------------------------------------------------------------
// Path & Directory Resolver (Supports macOS, Linux, Windows)
// -------------------------------------------------------------
function resolveBasePath(configPath) {
    if (!configPath) return null;
    let resolved = configPath.trim();

    // แทนที่ ~ ด้วย User Home Directory (ทั้ง macOS / Linux / Windows)
    if (resolved.startsWith('~')) {
        resolved = path.join(os.homedir(), resolved.slice(1));
    }

    // รองรับ %USERPROFILE% บน Windows
    if (resolved.includes('%USERPROFILE%')) {
        resolved = resolved.replace(/%USERPROFILE%/gi, process.env.USERPROFILE || os.homedir());
    }

    // ตัด wildcard suffix เช่น /* หรือ /**
    resolved = resolved.replace(/[\/\\]\*\*?$/, '');
    return path.resolve(resolved);
}

function scanProjectsFromBaseDir(baseDir) {
    if (!baseDir || !fs.existsSync(baseDir)) return {};
    const found = {};
    try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        for (const ent of entries) {
            if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
            const fullPath = path.join(baseDir, ent.name);

            // ตรวจสอบโฟลเดอร์โปรเจกต์ย่อย (เช่น FellowLIS/FellowApp)
            try {
                const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
                const subDirs = subEntries.filter(s => s.isDirectory() && !s.name.startsWith('.'));
                const hasRootMarker = fs.existsSync(path.join(fullPath, 'package.json')) ||
                    fs.existsSync(path.join(fullPath, '.git')) ||
                    fs.existsSync(path.join(fullPath, 'go.mod')) ||
                    fs.existsSync(path.join(fullPath, 'Cargo.toml'));

                if (!hasRootMarker && subDirs.length > 0) {
                    for (const sub of subDirs) {
                        found[sub.name] = path.join(fullPath, sub.name);
                    }
                } else {
                    found[ent.name] = fullPath;
                    for (const sub of subDirs) {
                        const subPath = path.join(fullPath, sub.name);
                        if (fs.existsSync(path.join(subPath, 'package.json')) || fs.existsSync(path.join(subPath, '.git'))) {
                            found[sub.name] = subPath;
                        }
                    }
                }
            } catch {
                found[ent.name] = fullPath;
            }
        }
    } catch (e) {
        console.error('Error scanning projects dir:', e);
    }
    return found;
}

// -------------------------------------------------------------
// Project Registry Management
// -------------------------------------------------------------
function loadProjects() {
    try {
        if (fs.existsSync(PROJECTS_FILE)) {
            return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
        }
    } catch (err) {
        console.error('Error loading projects.json:', err);
    }
    return {};
}

function saveProjects(projects) {
    try {
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error saving projects.json:', err);
    }
}

let projectRegistry = loadProjects();

function syncProjectRegistry() {
    const configuredPath = process.env.PROJECTS_DIR || '~/Documents/project';
    const baseDir = resolveBasePath(configuredPath);
    const scanned = scanProjectsFromBaseDir(baseDir);
    const existing = loadProjects();
    const merged = { ...existing, ...scanned };
    projectRegistry = merged;
    saveProjects(merged);
    console.log(`📁 Project Registry Synced: ${Object.keys(merged).length} projects (Base: ${baseDir})`);
}

function registerProject(name, cwd) {
    if (!name || !cwd) return;
    if (projectRegistry[name] !== cwd) {
        projectRegistry[name] = cwd;
        saveProjects(projectRegistry);
    }
}

function resolveProject(query) {
    if (!query) return { name: lastActiveProject || 'General', cwd: projectRegistry[lastActiveProject] || process.cwd() };

    const clean = query.trim();
    // 1. Exact match
    if (projectRegistry[clean]) {
        return { name: clean, cwd: projectRegistry[clean] };
    }

    // 2. Case-insensitive match
    const lower = clean.toLowerCase();
    for (const [name, cwd] of Object.entries(projectRegistry)) {
        if (name.toLowerCase() === lower) {
            return { name, cwd };
        }
    }

    // 3. Substring / Prefix match
    for (const [name, cwd] of Object.entries(projectRegistry)) {
        if (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())) {
            return { name, cwd };
        }
    }

    // 4. Check if directory exists under standard project root
    const configuredPath = process.env.PROJECTS_DIR || '~/Documents/project';
    const baseDir = resolveBasePath(configuredPath);
    if (baseDir) {
        const potentialPath = path.join(baseDir, clean);
        if (fs.existsSync(potentialPath)) {
            registerProject(clean, potentialPath);
            return { name: clean, cwd: potentialPath };
        }
    }

    return { name: clean, cwd: projectRegistry[lastActiveProject] || process.cwd() };
}

// -------------------------------------------------------------
// State Stores
// -------------------------------------------------------------
const pendingQuestions = new Map(); // reqId -> { project, cwd, resolve, type, messageId, timer, options }
const messageProjectMap = new Map(); // messageId -> { project, cwd, type, summary, timestamp }
const projectQueues = {}; // projectName -> Array<string>
const activeTasks = new Map(); // projectName -> { process, prompt, startTime, msgRef }
let lastActiveProject = 'General';

function recordMessageContext(messageId, context) {
    if (!messageId) return;
    if (messageProjectMap.size > 300) {
        const firstKey = messageProjectMap.keys().next().value;
        messageProjectMap.delete(firstKey);
    }
    messageProjectMap.set(messageId, { ...context, timestamp: Date.now() });
}

// Initial sync
syncProjectRegistry();

// -------------------------------------------------------------
// Express App & Discord Client
// -------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '10mb' }));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// -------------------------------------------------------------
// Helper: สร้าง Embed & Select Menu สำหรับแสดงรายชื่อโปรเจกต์
// -------------------------------------------------------------
function createProjectsEmbedWithMenu() {
    syncProjectRegistry();
    const entries = Object.entries(projectRegistry);
    const total = entries.length;

    const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`📂 โฟลเดอร์โปรเจกต์ทั้งหมด (${total} โครงการ)`)
        .setDescription(
            `คุณสามารถเลือกโปรเจกต์จาก **Dropdown Menu ด้านล่าง** หรือพิมพ์คำสั่ง \`/ai\` เพื่อเลือกโปรเจกต์พร้อม **Auto-complete** ได้ทันที!\n\n` +
            entries.slice(0, 15).map(([name, cwd], i) => `${i + 1}. **${name}**\n   \`${cwd.replace(os.homedir(), '~')}\``).join('\n') +
            (total > 15 ? `\n\n*(และอีก ${total - 15} โครงการใน Dropdown ด้านล่าง)*` : '')
        )
        .setFooter({ text: `โปรเจกต์ล่าสุด: [${lastActiveProject}] | เลือกโปรเจกต์จาก Dropdown ด้านล่างได้เลย` });

    const selectOptions = entries.slice(0, 25).map(([name, cwd]) => {
        const short = cwd.replace(os.homedir(), '~');
        return new StringSelectMenuOptionBuilder()
            .setLabel(name.slice(0, 100))
            .setValue(name.slice(0, 100))
            .setDescription(short.slice(0, 100))
            .setEmoji('📁');
    });

    const menu = new StringSelectMenuBuilder()
        .setCustomId('select_project')
        .setPlaceholder('📁 คลิกที่นี่เพื่อเลือกโฟลเดอร์โปรเจกต์...')
        .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(menu);
    return { embeds: [embed], components: [row] };
}

// -------------------------------------------------------------
// Register Discord Slash Commands (Global + Guilds)
// -------------------------------------------------------------
async function registerSlashCommands() {
    if (!BOT_TOKEN) return;
    try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        const commands = [
            new SlashCommandBuilder()
                .setName('ai')
                .setDescription('🚀 สั่งงาน Antigravity AI ในโปรเจกต์ที่เลือก (มี Autocomplete)')
                .addStringOption(opt =>
                    opt.setName('project')
                        .setDescription('เลือกโฟลเดอร์โปรเจกต์ (พิมพ์เพื่อค้นหาแบบ Auto-complete)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(opt =>
                    opt.setName('prompt')
                        .setDescription('คำสั่งหรือภารกิจที่ต้องการให้ AI ทำ')
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName('projects')
                .setDescription('📁 แสดงโฟลเดอร์โปรเจกต์ทั้งหมด พร้อม Dropdown Selection'),

            new SlashCommandBuilder()
                .setName('status')
                .setDescription('📊 ตรวจสอบสถานะระบบ งานที่กำลังรัน และคิวงาน'),

            new SlashCommandBuilder()
                .setName('help')
                .setDescription('📖 ดูคู่มือการใช้งานระบบ Discord Bridge'),

            new SlashCommandBuilder()
                .setName('stop')
                .setDescription('🛑 ยกเลิกงานที่กำลังประมวลผลอยู่')
                .addStringOption(opt =>
                    opt.setName('project')
                        .setDescription('โปรเจกต์ที่ต้องการหยุด')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
        ].map(cmd => cmd.toJSON());

        // Register Global
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Registered Slash Commands Globally');

        // Register in Guilds for instant access
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
                console.log(`⚡ Instant registered Slash Commands in Guild: ${guild.name} (${guildId})`);
            } catch (gErr) {
                console.warn(`Could not register in guild ${guildId}:`, gErr.message);
            }
        }
    } catch (err) {
        console.error('Error registering Slash Commands:', err);
    }
}

client.once('ready', async () => {
    console.log(`🤖 Discord Bridge ครบวงจร พร้อมทำงาน: ${client.user.tag}`);
    await registerSlashCommands();
});

// -------------------------------------------------------------
// Helper: Run Antigravity CLI Task (agy)
// -------------------------------------------------------------
async function runAgyTask(projectName, prompt, cwd, triggerContext = null) {
    const resolved = resolveProject(projectName);
    const targetProject = resolved.name;
    const targetCwd = cwd || resolved.cwd || process.cwd();
    lastActiveProject = targetProject;

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return false;

    if (activeTasks.has(targetProject)) {
        const current = activeTasks.get(targetProject);
        const replyText = `⚠️ **[${targetProject}]** กำลังรันงานอยู่:\n> "${current.prompt}"\n*(พิมพ์ \`!stop ${targetProject}\` เพื่อยกเลิก หรือใช้ \`!prompt\` เพื่อเข้าคิว)*`;
        if (triggerContext) {
            if (triggerContext.deferred || triggerContext.replied) {
                await triggerContext.followUp({ content: replyText });
            } else if (typeof triggerContext.reply === 'function') {
                await triggerContext.reply({ content: replyText });
            }
        }
        return false;
    }

    // สร้าง Start Embed
    const startEmbed = new EmbedBuilder()
        .setColor(COLORS.STARTED)
        .setTitle(`⏳ [${targetProject}] ได้รับคำสั่งใหม่`)
        .setDescription(`**คำสั่งที่ได้รับ:**\n> ${prompt}\n\n🤖 **สถานะ:** เริ่มต้น Antigravity Agent (agy)...`)
        .addFields({ name: '📁 ไดเรกทอรีทำงาน', value: `\`${targetCwd}\``, inline: false })
        .setTimestamp()
        .setFooter({ text: 'พิมพ์ !stop เพื่อยกเลิกงาน | กำลังประมวลผล...' });

    let statusMsg = null;
    if (triggerContext) {
        if (triggerContext.deferred) {
            statusMsg = await triggerContext.editReply({ embeds: [startEmbed] });
        } else if (triggerContext.replied) {
            statusMsg = await triggerContext.followUp({ embeds: [startEmbed] });
        } else if (typeof triggerContext.reply === 'function') {
            statusMsg = await triggerContext.reply({ embeds: [startEmbed] });
        }
    }

    if (!statusMsg) {
        statusMsg = await channel.send({ embeds: [startEmbed] });
    }

    recordMessageContext(statusMsg?.id, { project: targetProject, cwd: targetCwd, type: 'task' });

    console.log(`🚀 Starting agy task for [${targetProject}] in ${targetCwd}: "${prompt}"`);

    const agyBin = '/Users/chinjuku/.local/bin/agy';
    const child = spawn(agyBin, ['--dangerously-skip-permissions', '-p', prompt], {
        cwd: targetCwd,
        env: {
            ...process.env,
            PATH: `/Users/chinjuku/.gemini/antigravity-ide/bin:/Users/chinjuku/.local/bin:${process.env.PATH || ''}`
        }
    });

    let stdoutChunks = '';
    let stderrChunks = '';
    let reportedViaHook = false;

    activeTasks.set(targetProject, {
        process: child,
        prompt,
        startTime: Date.now(),
        msgRef: statusMsg,
        markReported: () => { reportedViaHook = true; }
    });

    child.stdout.on('data', (d) => {
        stdoutChunks += d.toString();
    });

    child.stderr.on('data', (d) => {
        stderrChunks += d.toString();
    });

    child.on('close', async (code) => {
        activeTasks.delete(targetProject);
        const durationSec = Math.round((Date.now() - (statusMsg?.createdTimestamp || Date.now())) / 1000);

        if (code === 0) {
            console.log(`✅ [${targetProject}] agy task completed successfully in ${durationSec}s`);
            if (!reportedViaHook) {
                const cleanOutput = stdoutChunks.trim() || 'คำสั่งทำงานเสร็จเรียบร้อย (ไม่มี Output เพิ่มเติม)';
                const truncated = cleanOutput.length > 3500 ? cleanOutput.slice(0, 3500) + '\n...(ข้อความยาวเกินไป ถูกตัด)' : cleanOutput;

                const finishEmbed = new EmbedBuilder()
                    .setColor(COLORS.COMPLETED)
                    .setTitle(`🎉 [${targetProject}] ทำงานเสร็จสิ้น (${durationSec} วินาที)`)
                    .setDescription(`**คำสั่ง:**\n> ${prompt}\n\n**ผลลัพธ์:**\n${truncated}`)
                    .setTimestamp()
                    .setFooter({ text: '💬 ตอบกลับ (Reply) ข้อความนี้เพื่อสั่งงานต่อได้ทันที' });

                const sent = await channel.send({ embeds: [finishEmbed] });
                recordMessageContext(sent.id, { project: targetProject, cwd: targetCwd, type: 'completed' });
            }
        } else {
            console.error(`❌ [${targetProject}] agy task exited with code ${code}`);
            const errorDetails = (stderrChunks || stdoutChunks).trim() || `Exit code: ${code}`;
            const truncatedErr = errorDetails.length > 2000 ? errorDetails.slice(0, 2000) + '...' : errorDetails;

            const failEmbed = new EmbedBuilder()
                .setColor(COLORS.FAILED)
                .setTitle(`❌ [${targetProject}] คำสั่งล้มเหลว (Code ${code})`)
                .setDescription(`**คำสั่ง:**\n> ${prompt}\n\n**รายละเอียด:**\n\`\`\`\n${truncatedErr}\n\`\`\``)
                .setTimestamp()
                .setFooter({ text: '💬 ตอบกลับข้อความนี้เพื่อลองสั่งใหม่' });

            const sent = await channel.send({ embeds: [failEmbed] });
            recordMessageContext(sent.id, { project: targetProject, cwd: targetCwd, type: 'failed' });
        }
    });

    return true;
}

// -------------------------------------------------------------
// Endpoint 1: AI ถามคำถามมายัง Discord (/ask)
// -------------------------------------------------------------
app.post('/ask', async (req, res) => {
    const {
        question,
        project = 'General',
        cwd = process.cwd(),
        type = 'text',
        options = [],
        timeout = 600
    } = req.body;

    registerProject(project, cwd);
    lastActiveProject = project;

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return res.status(500).json({ error: 'ไม่พบห้อง Discord' });

        const reqId = `${project}_${Date.now()}`;
        const components = [];

        const embed = new EmbedBuilder()
            .setColor(COLORS.QUESTION)
            .setTitle(type === 'buttons' ? `🔔 [${project}] Antigravity ต้องการให้ตัดสินใจ` : `💬 [${project}] Antigravity มีคำถาม`)
            .setDescription(question)
            .setTimestamp();

        if (type === 'buttons' && options.length > 0) {
            const row = new ActionRowBuilder();
            options.forEach(opt => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${reqId}:${opt.id}`)
                        .setLabel(opt.label || opt.id)
                        .setStyle(ButtonStyle[opt.style] || ButtonStyle.Primary)
                );
            });
            components.push(row);
            embed.setFooter({ text: '💡 คลิกปุ่มตัวเลือกด้านล่าง หรือพิมพ์ตอบกลับข้อความนี้' });
        } else {
            embed.setFooter({ text: '💡 พิมพ์ตอบกลับ (Reply) ข้อความนี้เพื่อส่งคำตอบ' });
        }

        const sentMsg = await channel.send({ embeds: [embed], components });
        recordMessageContext(sentMsg.id, { project, cwd, type: 'ask', reqId });

        const answer = await new Promise((resolve) => {
            const timer = setTimeout(() => {
                pendingQuestions.delete(reqId);
                resolve({ text: null, timeout: true });
            }, timeout * 1000);

            pendingQuestions.set(reqId, {
                project,
                cwd,
                resolve: (val) => {
                    clearTimeout(timer);
                    resolve(val);
                },
                type,
                messageId: sentMsg.id,
                options,
                embed
            });
        });

        if (answer.timeout) {
            const timeoutEmbed = EmbedBuilder.from(embed)
                .setColor(COLORS.FAILED)
                .setTitle(`⏱️ [${project}] คำขอหมดเวลา (Timeout)`)
                .setFooter({ text: 'หมดเวลารอคำตอบแล้ว' });

            const disabledRows = sentMsg.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(btn => btn.setDisabled(true));
                return newRow;
            });

            await sentMsg.edit({ embeds: [timeoutEmbed], components: disabledRows });
            return res.status(408).json({ error: 'Timeout' });
        }

        return res.json({ response: answer.text });
    } catch (error) {
        console.error('Error in /ask:', error);
        return res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// Endpoint 2: Agent รายงานสถานะ / สรุปผลงาน (/report)
// -------------------------------------------------------------
app.post('/report', async (req, res) => {
    const {
        status = 'completed',
        project = 'General',
        cwd = process.cwd(),
        message: detailMessage = '',
        files = '',
        snippet = '',
        error = ''
    } = req.body;

    registerProject(project, cwd);
    lastActiveProject = project;

    if (activeTasks.has(project)) {
        activeTasks.get(project).markReported?.();
    }

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return res.status(500).json({ error: 'ไม่พบห้อง Discord' });

        const embed = new EmbedBuilder().setTimestamp();

        switch (status) {
            case 'started':
                embed.setColor(COLORS.STARTED)
                    .setTitle(`🚀 [${project}] เริ่มดำเนินงาน`)
                    .setDescription(`**ภารกิจ:**\n${detailMessage || 'กำลังเริ่มกระบวนการ...'}`)
                    .setFooter({ text: 'กำลังดำเนินการ...' });
                break;

            case 'progress':
                embed.setColor(COLORS.PROGRESS)
                    .setTitle(`⚙️ [${project}] ความคืบหน้า`)
                    .setDescription(detailMessage || 'กำลังทำงานในขั้นตอนถัดไป...')
                    .setFooter({ text: 'In Progress' });
                break;

            case 'failed':
            case 'error':
                embed.setColor(COLORS.FAILED)
                    .setTitle(`❌ [${project}] เกิดข้อผิดพลาด`)
                    .setDescription(`**ข้อผิดพลาด:**\n${detailMessage || error || 'ไม่ทราบสาเหตุ'}`)
                    .setFooter({ text: '💬 ตอบกลับ (Reply) ข้อความนี้เพื่อสั่งให้แก้ไข' });
                break;

            case 'completed':
            default:
                embed.setColor(COLORS.COMPLETED)
                    .setTitle(`🎉 [${project}] ทำงานเสร็จสมบูรณ์!`)
                    .setDescription(`**สรุปผลงาน:**\n${detailMessage || 'งานเสร็จสิ้นเรียบร้อย'}`);

                if (files) {
                    const fileText = typeof files === 'string'
                        ? files
                        : Array.isArray(files)
                            ? files.join('\n')
                            : JSON.stringify(files);
                    embed.addFields({
                        name: '📁 ไฟล์ที่เกี่ยวข้อง / แก้ไข',
                        value: fileText.length > 1024 ? fileText.slice(0, 1020) + '...' : fileText,
                        inline: false
                    });
                }

                if (snippet) {
                    const snippetText = snippet.length > 1000 ? snippet.slice(0, 1000) + '\n// ...' : snippet;
                    embed.addFields({
                        name: '🔍 Code Snippet',
                        value: `\`\`\`typescript\n${snippetText}\n\`\`\``,
                        inline: false
                    });
                }

                embed.setFooter({ text: '💡 ตอบกลับ (Reply) ข้อความนี้ หรือพิมพ์ /ai เพื่อสั่งงานต่อได้ทันที' });
                break;
        }

        const sentMsg = await channel.send({ embeds: [embed] });
        recordMessageContext(sentMsg.id, { project, cwd, type: status, summary: detailMessage });

        return res.json({ success: true });
    } catch (error) {
        console.error('Error in /report:', error);
        return res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// Endpoint 3: Agent ดึงคิวงานตาม Project (/get-next-prompt)
// -------------------------------------------------------------
app.get('/get-next-prompt', (req, res) => {
    const project = req.query.project || 'General';

    if (projectQueues[project] && projectQueues[project].length > 0) {
        const prompt = projectQueues[project].shift();
        return res.json({ hasPrompt: true, project, prompt });
    }

    if (project !== 'General' && projectQueues['General'] && projectQueues['General'].length > 0) {
        const prompt = projectQueues['General'].shift();
        return res.json({ hasPrompt: true, project: 'General', prompt });
    }

    return res.json({ hasPrompt: false, project, prompt: null });
});

// -------------------------------------------------------------
// Endpoint 4: ดูโปรเจกต์และสถานะทั้งหมด
// -------------------------------------------------------------
app.get('/projects', (req, res) => {
    syncProjectRegistry();
    return res.json({ projects: projectRegistry });
});

app.get('/status', (req, res) => {
    return res.json({
        activeTasks: Array.from(activeTasks.keys()),
        pendingQuestions: pendingQuestions.size,
        queues: projectQueues,
        lastActiveProject
    });
});

// -------------------------------------------------------------
// Discord Event: รองรับ Autocomplete, Slash Commands, Buttons, Select Menus, Modals
// -------------------------------------------------------------
client.on('interactionCreate', async (interaction) => {
    // ---------------------------------------------------------
    // 1. AUTOCOMPLETE: สำหรับเลือกชื่อโปรเจกต์ (/ai, /stop)
    // ---------------------------------------------------------
    if (interaction.isAutocomplete()) {
        const focused = interaction.options.getFocused(true);
        if (focused.name === 'project') {
            const query = (focused.value || '').toLowerCase().trim();
            const allProjects = Object.keys(projectRegistry);
            const filtered = allProjects
                .filter(name => name.toLowerCase().includes(query))
                .slice(0, 25);

            await interaction.respond(
                filtered.map(name => ({
                    name: name.slice(0, 100),
                    value: name.slice(0, 100)
                }))
            );
        }
        return;
    }

    // ---------------------------------------------------------
    // 2. SLASH COMMANDS
    // ---------------------------------------------------------
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // /ai project:<name> prompt:<text>
        if (commandName === 'ai') {
            const project = interaction.options.getString('project');
            const prompt = interaction.options.getString('prompt');
            await interaction.deferReply();
            await runAgyTask(project, prompt, null, interaction);
            return;
        }

        // /projects
        if (commandName === 'projects') {
            const payload = createProjectsEmbedWithMenu();
            await interaction.reply(payload);
            return;
        }

        // /status
        if (commandName === 'status') {
            const runningList = Array.from(activeTasks.entries()).map(([proj, task]) => {
                const elapsed = Math.round((Date.now() - task.startTime) / 1000);
                return `⏳ **[${proj}]** (${elapsed}s): "${task.prompt}"`;
            });

            let queueList = [];
            for (const [proj, list] of Object.entries(projectQueues)) {
                if (list.length > 0) {
                    queueList.push(`📁 **${proj}** (${list.length} รายการ):\n` + list.map((p, i) => `   ${i + 1}. ${p}`).join('\n'));
                }
            }

            const pendingList = Array.from(pendingQuestions.values()).map(q => `❓ **[${q.project}]**: "${q.type === 'buttons' ? 'รอเลือกปุ่ม' : 'รอพิมพ์ตอบ'}"`);

            const statusEmbed = new EmbedBuilder()
                .setColor(COLORS.PROGRESS)
                .setTitle('📋 สถานะระบบ Antigravity Bridge')
                .addFields(
                    { name: '🏃 งานที่กำลังประมวลผลอยู่', value: runningList.length > 0 ? runningList.join('\n') : 'ไม่มีงานกำลังรัน', inline: false },
                    { name: '📥 คิวงานรอประมวลผล', value: queueList.length > 0 ? queueList.join('\n\n') : 'ไม่มีคิวงานค้าง', inline: false },
                    { name: '❓ คำถามที่รอคุณตอบ', value: pendingList.length > 0 ? pendingList.join('\n') : 'ไม่มีคำถามค้าง', inline: false },
                    { name: '📁 โปรเจกต์ล่าสุด', value: `\`${lastActiveProject}\``, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [statusEmbed] });
            return;
        }

        // /help
        if (commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor(COLORS.INFO)
                .setTitle('📖 คู่มือระบบ Discord Bridge ครบวงจร')
                .setDescription('คุณสามารถสั่งงาน ควบคุม และรับการแจ้งเตือนจาก Antigravity ได้สะดวกสุดๆ:')
                .addFields(
                    {
                        name: '🚀 สั่งงาน AI ผ่าน Slash Command (พิมพ์แล้วมี Auto-complete ทันที)',
                        value: '• `/ai project:<ชื่อ> prompt:<คำสั่ง>` : สั่งงานตรงไปยังโปรเจกต์ที่เลือก\n• `/projects` : แสดงรายชื่อโฟลเดอร์ทั้งหมด พร้อม Dropdown Selection ให้กดเลือก'
                    },
                    {
                        name: '💬 สั่งงานต่อเนื่องผ่านการ Reply',
                        value: '• เพียงกด **Reply (ตอบกลับ)** ข้อความแจ้งเตือนผลงานล่าสุดของบอท เพื่อสั่งงานต่อได้ทันที!'
                    },
                    {
                        name: '📊 ตรวจสอบสถานะและหยุดงาน',
                        value: '• `/status` : ดูงานที่กำลังรันและคิวงาน\n• `/stop [project]` : หยุดงานที่กำลังรันอยู่'
                    }
                )
                .setFooter({ text: 'Antigravity Discord Bridge v2.1' });

            await interaction.reply({ embeds: [helpEmbed] });
            return;
        }

        // /stop
        if (commandName === 'stop') {
            const target = interaction.options.getString('project') || lastActiveProject;
            if (activeTasks.has(target)) {
                const task = activeTasks.get(target);
                try {
                    task.process.kill('SIGTERM');
                } catch (e) {
                    console.error(e);
                }
                activeTasks.delete(target);
                await interaction.reply(`🛑 ยกเลิกการรันงานของโปรเจกต์ **[${target}]** เรียบร้อยแล้ว`);
            } else {
                await interaction.reply(`⚠️ ไม่พบงานที่กำลังรันสำหรับโปรเจกต์ **[${target}]**`);
            }
            return;
        }
    }

    // ---------------------------------------------------------
    // 3. SELECT MENU: เมื่อเลือกโปรเจกต์จาก Dropdown
    // ---------------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_project') {
        const selected = interaction.values[0];
        const cwd = projectRegistry[selected] || 'Unknown';
        lastActiveProject = selected;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_run_task:${selected}`)
                .setLabel('🚀 สั่งงาน AI ในโปรเจกต์นี้')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`btn_status:${selected}`)
                .setLabel('📊 ตรวจสอบสถานะ')
                .setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle(`📁 โฟลเดอร์ที่เลือก: [${selected}]`)
            .setDescription(`**ไดเรกทอรี:** \`${cwd}\`\n\n💡 กดปุ่ม **"🚀 สั่งงาน AI ในโปรเจกต์นี้"** ด้านล่างเพื่อพิมพ์คำสั่งได้ทันที หรือพิมพ์ \`/ai project:${selected}\``)
            .setFooter({ text: `ตั้งเป็นโปรเจกต์ปัจจุบันเรียบร้อยแล้ว` });

        await interaction.reply({ embeds: [embed], components: [row] });
        return;
    }

    // ---------------------------------------------------------
    // 4. BUTTONS
    // ---------------------------------------------------------
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // 4.1 ปุ่มสั่งงาน AI -> เปิด Modal กรอกคำสั่ง
        if (customId.startsWith('btn_run_task:')) {
            const selected = customId.replace('btn_run_task:', '');
            const modal = new ModalBuilder()
                .setCustomId(`modal_run_task:${selected}`)
                .setTitle(`สั่งงาน AI: ${selected.slice(0, 30)}`);

            const promptInput = new TextInputBuilder()
                .setCustomId('task_prompt')
                .setLabel('ระบุคำสั่งหรือภารกิจที่ต้องการให้ AI ทำ')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('เช่น เพิ่มปุ่มลบสินค้าในตาราง, แก้ไขบั๊กใน SupplierEvaluateModal, ฯลฯ')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(promptInput));
            await interaction.showModal(modal);
            return;
        }

        // 4.2 ปุ่มดูสถานะ
        if (customId.startsWith('btn_status:')) {
            const selected = customId.replace('btn_status:', '');
            const isRunning = activeTasks.has(selected);
            const current = activeTasks.get(selected);

            const statusText = isRunning
                ? `⏳ กำลังรันงาน: "${current.prompt}"`
                : '🟢 ว่าง (ไม่มีงานกำลังรัน)';

            await interaction.reply({
                content: `📊 **สถานะ [${selected}]:**\n${statusText}`,
                ephemeral: true
            });
            return;
        }

        // 4.3 ปุ่มตอบคำถามของ AI (/ask)
        const [reqId, actionId] = customId.split(':');
        const pending = pendingQuestions.get(reqId);

        if (pending) {
            pending.resolve({ text: actionId });
            pendingQuestions.delete(reqId);

            const disabledRows = interaction.message.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(btn => btn.setDisabled(true));
                return newRow;
            });

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0] || pending.embed)
                .setColor(COLORS.ANSWERED)
                .setTitle(`✅ [${pending.project}] บันทึกคำตอบแล้ว`)
                .addFields({
                    name: '🎯 ตัวเลือกที่เลือก',
                    value: `**${actionId}** (เลือกโดย <@${interaction.user.id}>)`,
                    inline: false
                })
                .setFooter({ text: 'ส่งข้อมูลกลับไปยัง Antigravity เรียบร้อยแล้ว' });

            await interaction.update({ embeds: [updatedEmbed], components: disabledRows });
            console.log(`🔘 Button pressed: [${pending.project}] -> ${actionId} by ${interaction.user.tag}`);
        } else {
            await interaction.reply({
                content: '⚠️ คำขอนี้ได้รับการตอบหรือหมดเวลาไปแล้ว',
                ephemeral: true
            });
        }
        return;
    }

    // ---------------------------------------------------------
    // 5. MODAL SUBMIT: รับคำสั่งงานจากฟอร์ม Pop-up
    // ---------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_run_task:')) {
        const project = interaction.customId.replace('modal_run_task:', '');
        const prompt = interaction.fields.getTextInputValue('task_prompt');

        await interaction.reply({
            content: `⚡ **[${project}]** รับคำสั่งเรียบร้อย กำลังเริ่มประมวลผล...`,
            ephemeral: false
        });

        await runAgyTask(project, prompt, null, interaction);
    }
});

// -------------------------------------------------------------
// Discord Event: รองรับข้อความแชทจากมือถือ / Text Commands
// -------------------------------------------------------------
client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== CHANNEL_ID) return;

    const rawContent = message.content.trim();
    if (!rawContent) return;

    // ---------------------------------------------------------
    // Case A: Reply ข้อความของบอท
    // ---------------------------------------------------------
    if (message.reference && message.reference.messageId) {
        const refId = message.reference.messageId;

        // A1. ถ้า Reply ข้อความคำถาม
        const pendingEntry = Array.from(pendingQuestions.entries()).find(([_, val]) => val.messageId === refId);
        if (pendingEntry) {
            const [reqId, val] = pendingEntry;
            val.resolve({ text: rawContent });
            pendingQuestions.delete(reqId);

            await message.react('✅');
            const confirmEmbed = new EmbedBuilder()
                .setColor(COLORS.ANSWERED)
                .setTitle(`✅ [${val.project}] บันทึกคำตอบเรียบร้อย`)
                .setDescription(`**คำตอบของคุณ:**\n> ${rawContent}`)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });
            return;
        }

        // A2. ถ้า Reply ข้อความรายงานผลงาน -> สั่งงานต่อยอดทันที!
        const refContext = messageProjectMap.get(refId);
        if (refContext) {
            const targetProj = refContext.project;
            const targetCwd = refContext.cwd;

            await message.react('🚀');
            console.log(`🔄 Follow-up prompt via reply for [${targetProj}]: "${rawContent}"`);
            await runAgyTask(targetProj, rawContent, targetCwd, message);
            return;
        }
    }

    // ---------------------------------------------------------
    // Case B: พิมพ์ตอบคำถาม text ล่าสุด (โดยไม่ใช้ prefix)
    // ---------------------------------------------------------
    if (!rawContent.startsWith('!') && !rawContent.startsWith('/')) {
        const activeTextReq = Array.from(pendingQuestions.entries()).reverse().find(([_, val]) => val.type === 'text');
        if (activeTextReq) {
            const [reqId, val] = activeTextReq;
            val.resolve({ text: rawContent });
            pendingQuestions.delete(reqId);

            await message.react('✅');
            const confirmEmbed = new EmbedBuilder()
                .setColor(COLORS.ANSWERED)
                .setTitle(`✅ [${val.project}] ได้รับคำตอบแล้ว`)
                .setDescription(`**คำตอบของคุณ:**\n> ${rawContent}`)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });
            return;
        }
    }

    // ---------------------------------------------------------
    // Case C: Text Commands (!projects, !help, !status, !ai, ฯลฯ)
    // ---------------------------------------------------------

    // 1. !projects
    if (rawContent === '!projects' || rawContent === '!list') {
        const payload = createProjectsEmbedWithMenu();
        await message.reply(payload);
        return;
    }

    // 2. !help
    if (rawContent === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('📖 คู่มือระบบ Discord Bridge ครบวงจร')
            .setDescription('คุณสามารถสั่งงาน ควบคุม และรับการแจ้งเตือนจาก Antigravity ได้สะดวกสุดๆ:')
            .addFields(
                {
                    name: '🚀 สั่งงาน AI ผ่าน Slash Command (พิมพ์แล้วมี Auto-complete ทันที)',
                    value: '• `/ai project:<ชื่อ> prompt:<คำสั่ง>` : สั่งงานตรงไปยังโปรเจกต์ที่เลือก\n• `/projects` หรือ `!projects` : แสดงรายชื่อโฟลเดอร์ทั้งหมด พร้อม Dropdown Selection ให้กดเลือก'
                },
                {
                    name: '💬 สั่งงานต่อเนื่องผ่านการ Reply',
                    value: '• เพียงกด **Reply (ตอบกลับ)** ข้อความแจ้งเตือนผลงานล่าสุดของบอท เพื่อสั่งงานต่อได้ทันที!'
                },
                {
                    name: '📊 ตรวจสอบสถานะและหยุดงาน',
                    value: '• `/status` หรือ `!status` : ดูงานที่กำลังรันและคิวงาน\n• `/stop` หรือ `!stop` : หยุดงานที่กำลังรันอยู่'
                }
            )
            .setFooter({ text: 'Antigravity Discord Bridge v2.1' });

        await message.reply({ embeds: [helpEmbed] });
        return;
    }

    // 3. !status หรือ !queue
    if (rawContent === '!status' || rawContent === '!queue') {
        const runningList = Array.from(activeTasks.entries()).map(([proj, task]) => {
            const elapsed = Math.round((Date.now() - task.startTime) / 1000);
            return `⏳ **[${proj}]** (${elapsed}s): "${task.prompt}"`;
        });

        let queueList = [];
        for (const [proj, list] of Object.entries(projectQueues)) {
            if (list.length > 0) {
                queueList.push(`📁 **${proj}** (${list.length} รายการ):\n` + list.map((p, i) => `   ${i + 1}. ${p}`).join('\n'));
            }
        }

        const pendingList = Array.from(pendingQuestions.values()).map(q => `❓ **[${q.project}]**: "${q.type === 'buttons' ? 'รอเลือกปุ่ม' : 'รอพิมพ์ตอบ'}"`);

        const statusEmbed = new EmbedBuilder()
            .setColor(COLORS.PROGRESS)
            .setTitle('📋 สถานะระบบ Antigravity Bridge')
            .addFields(
                { name: '🏃 งานที่กำลังประมวลผลอยู่', value: runningList.length > 0 ? runningList.join('\n') : 'ไม่มีงานกำลังรัน', inline: false },
                { name: '📥 คิวงานรอประมวลผล', value: queueList.length > 0 ? queueList.join('\n\n') : 'ไม่มีคิวงานค้าง', inline: false },
                { name: '❓ คำถามที่รอคุณตอบ', value: pendingList.length > 0 ? pendingList.join('\n') : 'ไม่มีคำถามค้าง', inline: false },
                { name: '📁 โปรเจกต์ล่าสุด', value: `\`${lastActiveProject}\``, inline: true }
            )
            .setTimestamp();

        await message.reply({ embeds: [statusEmbed] });
        return;
    }

    // 4. !stop หรือ !cancel
    if (rawContent.startsWith('!stop') || rawContent.startsWith('!cancel')) {
        const target = rawContent.split(/\s+/)[1] || lastActiveProject;
        if (activeTasks.has(target)) {
            const task = activeTasks.get(target);
            try {
                task.process.kill('SIGTERM');
            } catch (e) {
                console.error(e);
            }
            activeTasks.delete(target);
            await message.reply(`🛑 ยกเลิกการรันงานของโปรเจกต์ **[${target}]** เรียบร้อยแล้ว`);
        } else {
            await message.reply(`⚠️ ไม่พบงานที่กำลังรันสำหรับโปรเจกต์ **[${target}]**`);
        }
        return;
    }

    // 5. !ai <คำสั่ง> หรือ !do <คำสั่ง>
    if (rawContent.startsWith('!ai ') || rawContent.startsWith('!do ')) {
        const fullCmd = rawContent.replace(/^!(ai|do)\s+/, '').trim();
        let targetProject = lastActiveProject || 'General';
        let actualPrompt = fullCmd;

        const match = fullCmd.match(/^\[(.*?)\]\s*(.*)/);
        if (match) {
            targetProject = match[1];
            actualPrompt = match[2];
        }

        await message.react('⚡');
        await runAgyTask(targetProject, actualPrompt, null, message);
        return;
    }

    // 6. !prompt [<project>] <ข้อความ>
    if (rawContent.startsWith('!prompt ')) {
        const fullCmd = rawContent.replace(/^!prompt\s+/, '').trim();
        let targetProject = lastActiveProject || 'General';
        let actualPrompt = fullCmd;

        const match = fullCmd.match(/^\[(.*?)\]\s*(.*)/);
        if (match) {
            targetProject = match[1];
            actualPrompt = match[2];
        }

        if (!projectQueues[targetProject]) {
            projectQueues[targetProject] = [];
        }
        projectQueues[targetProject].push(actualPrompt);

        await message.react('📥');
        await message.reply(`📌 **[${targetProject}]** บันทึกเข้าคิวงานเรียบร้อย:\n> "${actualPrompt}"`);
        return;
    }
});

// -------------------------------------------------------------
// เริ่มการทำงาน
// -------------------------------------------------------------
client.login(BOT_TOKEN);
app.listen(PORT, () => {
    console.log(`🚀 Bridge พร้อมทำงานแบบครบวงจรที่ http://localhost:${PORT}`);
    console.log(`📁 โครงการที่ลงทะเบียนไว้: ${Object.keys(projectRegistry).length} โครงการ`);
});
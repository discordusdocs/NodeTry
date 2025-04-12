require('dotenv').config();
const fs = require('fs');
const axios = require("axios");
const cheerio = require("cheerio");
const { Client, GatewayIntentBits, ButtonBuilder, ActionRowBuilder, ButtonStyle, Events, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration]
});


const token = process.env.BOT_TOKEN;

let userPoints = {};
const pointsFile = 'points.json';

if (fs.existsSync(pointsFile)) {
    userPoints = JSON.parse(fs.readFileSync(pointsFile));
} else {
    fs.writeFileSync(pointsFile, JSON.stringify(userPoints, null, 4));
}

function savePoints() {
    fs.writeFileSync(pointsFile, JSON.stringify(userPoints, null, 4));
}

// Load user agreements from a JSON file
let userAgreements = {};
if (fs.existsSync('agreements.json')) {
    userAgreements = JSON.parse(fs.readFileSync('agreements.json'));
}

// Save user agreements to a JSON file
function saveAgreements() {
    fs.writeFileSync('agreements.json', JSON.stringify(userAgreements, null, 4));
}

client.once('ready', async() => {
    console.log(`Logged in as ${client.user.tag}!`);
    const commands = [
        new SlashCommandBuilder()
            .setName('realb')
            .setDescription('realb API')
            .addStringOption(option =>
                option.setName("query")
                    .setDescription("Search Query")
                    .setRequired(true)
            )
            .toJSON(),  // <-- Fix here
    
        new SlashCommandBuilder()
            .setName('inviteproof')
            .setDescription('Invite proof')
            .addAttachmentOption(option =>
                option.setName("proof")
                    .setDescription("Invite picture")
                    .setRequired(true)
            )
            .toJSON(),  // <-- Fix here
    ];
    
    const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
    try {
        console.log("Registering slash commands...");
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: commands,
        });
        console.log("Slash commands registered successfully!");
    } catch (error) {
        console.error(`Failed to register commands: ${error.message}`);
    }
});

// Handle interactions
client.on(Events.InteractionCreate, async(interaction) => {
    const {commandName} = interaction;
    
    if (commandName == "realb") {
        try {
            let query = interaction.options.getString('query').trim();
    
            if (!query) {
                return interaction.reply('Please provide a valid search term.');
            }
    
            // Replace spaces with '+'
            query = query.replace(/\s+/g, '+');
    
            const random = () => Math.floor(Math.random() * 5) + 1;
            const pid = random();
            const url = `https://porn.pics/search/${query}/page/${pid}`;
    
            await interaction.deferReply();
    
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                },
                validateStatus: status => status < 500
            });
    
            if (!data) {
                return interaction.editReply(`Failed to fetch data from **${url}**`);
            }
    
            const $ = cheerio.load(data);
            const images = [];
    
            $('img').each((i, element) => {
                const imgUrl = $(element).attr('src');
                if (imgUrl && imgUrl.startsWith('http') && !imgUrl.toLowerCase().includes('logo')) {
                    images.push(imgUrl);
                }
            });
    
            if (images.length > 0) {
                const maxResults = Math.min(images.length, 5);
                const results = images.slice(0, maxResults)
                    .map((img, i) => `**Content ${i + 1}** | [Source](${img})`)
                    .join('\n');
    
                await interaction.editReply({
                    content: `Searched: **${url}**\n${results}`
                });
            } else {
                await interaction.editReply(`No suitable images found for query: **${query.replace(/\+/g, ' ')}**\nSearched: **${url}**`);
            }
          } catch (error) {
            console.error('Error fetching image:', error.response?.status, error.message);
            if (error.response?.status === 400) {
                await interaction.editReply('Bad request. Please check the search term and try again.');
            } else if (error.response?.status === 404) {
                await interaction.editReply('No results found for your search term.');
            } else {
                await interaction.editReply('An error occurred while fetching data.');
            }
          }
    } 
    if (commandName === "inviteproof") {
        const attachment = interaction.options.getAttachment("proof");
        const proofChannelId = "1360497909690531911"; // 🔁 Replace with the actual channel ID
        const proofChannel = client.channels.cache.get(proofChannelId);
    
        if (!proofChannel || !attachment) {
            return interaction.reply({
                content: "Failed to find the channel or attachment. Please try again.",
                ephemeral: true
            });
        }
    
        try {
            await proofChannel.send({
                content: `📥 Invite proof submitted by <@${interaction.user.id}>`,
                files: [attachment.url]
            });
    
            await interaction.reply({
                content: "✅ Your invite proof has been submitted successfully.",
                ephemeral: true
            });
        } catch (error) {
            console.error("Error sending invite proof:", error);
            await interaction.reply({
                content: "❌ Failed to submit your invite proof. Try again later.",
                ephemeral: true
            });
        }
    }
    
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;

    if (interaction.customId === "rules_accept") {
        userAgreements[userId] = true;
        saveAgreements();

        await interaction.reply({
            content: "**You have accepted the rules! You may now verify. :white_check_mark:**",
            ephemeral: true
        });
    }

    if (interaction.customId === "verify") {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!member) {
            return interaction.reply({
                content: "**Error: Unable to fetch member.**",
                ephemeral: true
            });
        }

        if (!userAgreements[userId]) {
            return interaction.reply({
                content: "**You must accept the rules before verifying. :x:**",
                ephemeral: true
            });
        }

        const roleId = "1352790515543838961";

        await interaction.reply({
            content: `**User Process: ${userId}**`,
            ephemeral: true
        });

        setTimeout(async () => {
            try {
                await member.roles.add(roleId);
                await interaction.followUp({
                    content: "**Verification Successful! :white_check_mark:**",
                    ephemeral: true
                });
            } catch (error) {
                console.error("Error adding role:", error);
                await interaction.followUp({
                    content: "**Failed to assign the role. Please try again later. :x:**",
                    ephemeral: true
                });
            }
        }, 3000);
    }
    
});

// Handle commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!ruleset') {
        if (message.author.id !== "1340164162604503112") {
            return
        }
        const acceptButton = new ButtonBuilder()
            .setCustomId("rules_accept")
            .setLabel("Accept Rules")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(acceptButton);

        await message.channel.send({
            content: "# :scroll: Rules\n" +
                "1. **No NSFW Outside of NSFW Channels** – Keep NSFW content strictly within designated NSFW channels.\n" +
                "2. **No Spamming** – Avoid excessive messages, emojis, mentions, or reactions.\n" +
                "3. **No Self-Promotion** – Advertising or self-promotion (including DMs) is not allowed unless approved by staff.\n" +
                "4. **Respect Privacy** – Do not share personal information publicly or in DMs.\n" +
                "5. **No Impersonation** – Do not pretend to be other members, staff, or bots.\n" +
                "6. **Do Not Leak Content** – If you have paid for exclusive content, you may not share it with others.",
            components: [row]
        });
        message.delete()
    }


    if (message.content.startsWith("!point_add")) {
        if (message.author.id !== "1340164162604503112") return;
    
        const args = message.content.split(' ');
    
        if (args.length < 3) {
            return message.reply("Usage: `!point_add <userId> <amount>`");
        }
    
        const userId = args[1];
        const amount = parseInt(args[2], 10);
    
        if (isNaN(amount)) {
            return message.reply("Please provide a valid number.");
        }
    
        if (!userPoints[userId]) {
            userPoints[userId] = 0;
        }
    
        userPoints[userId] += amount;
        savePoints();
    
        message.reply(`Added ${amount} point(s) to <@${userId}>. They now have ${userPoints[userId]} point(s).`);
    }

    if (message.content === "!balance") {
        message.reply(`You currently have ${userPoints[message.author.id]} point(s).`)
    }    

    if (message.content === '!vpset') {
        if (message.author.id !== "1340164162604503112") {
            return
        }
        const verifyButton = new ButtonBuilder()
            .setCustomId("verify")
            .setLabel("Verify")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(verifyButton);

        await message.channel.send({
            content: "**Click the button below to verify once you've accepted the rules.**",
            components: [row]
        });
        message.delete()
    }
});

client.login(token);

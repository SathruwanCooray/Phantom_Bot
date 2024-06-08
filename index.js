require('dotenv').config(); // Load environment variables from .env
const { Client, GatewayIntentBits, PermissionFlagsBits, ActivityType } = require('discord.js');
const XOXGame = require('./XOXGame');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const token = process.env.DISCORD_TOKEN;

const activeGames = new Map(); // Map to store active games per server

client.once('ready', async () => {
    console.log('Bot is online!');

    try {
        await client.guilds.fetch();

        const serverCount = client.guilds.cache.size;

        client.user.setActivity(`${serverCount} servers`, { type: ActivityType.Listening });
    } catch (error) {
        console.error('Error fetching guilds:', error);
    }
});

client.on('messageCreate', async message => {
    console.log(`${message.author.username}: ${message.content}`);

    if (message.content.startsWith('!XOX')) {
        try {
            const guild = message.guild;

            if (!guild) {
                console.error('Guild not found!');
                return;
            }

            // Check if a user is mentioned
            const mentionedUser = message.mentions.users.first();
            if (!mentionedUser) {
                message.reply('Please mention a user to create a channel with.');
                return;
            }

            const player1Id = message.author.id;
            const player2Id = mentionedUser.id;
            const gameKey = `${player1Id}-${player2Id}`;

            // Get the server's active games map, or create a new one if it doesn't exist
            let serverGames = activeGames.get(message.guild.id);
            if (!serverGames) {
                serverGames = new Map();
                activeGames.set(message.guild.id, serverGames);
            }

            // Check if the game between the two users already exists in the same server
            if (serverGames.has(gameKey) || serverGames.has(`${player2Id}-${player1Id}`)) {
                message.reply('A game between you and the mentioned user is already in progress in this server.');
                return;
            }

            const channelName = `${message.author.username}-${mentionedUser.username}`;

            const newChannel = await guild.channels.create({
                name: channelName,
                type: 0, // 0 for text channel, 2 for voice channel
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: player1Id,
                        allow: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: player2Id,
                        allow: [PermissionFlagsBits.ViewChannel],
                    },
                ],
            });

            console.log(`New channel created: ${newChannel.name}`);
            message.reply(`XOX game :video_game:  <#${newChannel.id}> created! :star2:`);

            const gameInstance = new XOXGame(newChannel, client, message.author, mentionedUser);
            serverGames.set(gameKey, gameInstance);

            // Remove the game from the server's active games map when the game ends
            gameInstance.once('gameEnd', () => {
                const serverGames = activeGames.get(message.guild.id);
                if (serverGames) {
                    serverGames.delete(gameKey);
                }
                console.log(`Game between ${message.author.username} and ${mentionedUser.username} in ${message.guild.name} has ended.`);
            });
        } catch (error) {
            console.error('Error creating channel:', error);
            message.reply('An error occurred while creating the channel.');
        }
    }
});

client.login(token);
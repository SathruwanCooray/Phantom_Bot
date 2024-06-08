const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EventEmitter } = require('events');

const games = new Map();

class XOXGame extends EventEmitter {
    constructor(newChannel, client, author, mentionedUser) {
        super();
        this.newChannel = newChannel;
        this.client = client;
        this.author = author;
        this.mentionedUser = mentionedUser;
        this.previousMover = null;
        this.player1 = { id: null, moves: [], openingPlayer: false };
        this.player2 = { id: null, moves: [], openingPlayer: false };
        this.matrix = [
            ["-", "-", "-"],
            ["-", "-", "-"],
            ["-", "-", "-"]
        ];

        this.init();
    }

    createButtons() {
        const buttons = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const button = new ButtonBuilder()
                    .setCustomId(`${i},${j}`)
                    .setLabel(this.matrix[i][j])
                    .setStyle(ButtonStyle.Secondary);
                row.addComponents(button);
            }
            buttons.push(row);
        }
        return buttons;
    }

    updatePlayerMoves(player, row, col, interaction) {
        if (player.moves.length === 3) {
            // Remove the oldest move
            const [oldRow, oldCol] = player.moves.shift().split(',').map(Number);
            this.matrix[oldRow][oldCol] = "-";
            this.updateButtonLabel(interaction.message, oldRow, oldCol, "-");
        }
        player.moves.push(`${row},${col}`);
    }

    async updateButtonLabel(message, row, col, label) {
        const actionRow = message.components[row];
        const buttonIndex = actionRow.components.findIndex(button => button.customId === `${row},${col}`);
        const button = actionRow.components[buttonIndex];

        if (button) {
            const updatedButton = new ButtonBuilder()
                .setCustomId(button.customId)
                .setLabel(label)
                .setStyle(ButtonStyle.Secondary);

            actionRow.components[buttonIndex] = updatedButton;

            await message.edit({ components: message.components });
        }
    }

    checkWinner(player) {
        const moves = player.moves.map(move => move.split(',').map(Number));
        const rows = [0, 0, 0];
        const cols = [0, 0, 0];
        let diag1 = 0;
        let diag2 = 0;

        moves.forEach(([row, col]) => {
            rows[row]++;
            cols[col]++;
            if (row === col) diag1++;
            if (row + col === 2) diag2++;
        });

        return rows.includes(3) || cols.includes(3) || diag1 === 3 || diag2 === 3;
    }

    async init() {
        const message = await this.newChannel.send('Starting XOX Game...');
        await message.edit({ components: this.createButtons() });

        const interactionListener = async interaction => {
            if (!interaction.isButton()) return;

            const game = games.get(interaction.channel.id);
            if (!game) return; // No game found for this channel

            // Check if it's the user's turn
            if (interaction.user.id === game.previousMover) {
                await interaction.reply({ content: " :rotating_light: It's not your turn! :rotating_light: ", ephemeral: true });
                return;
            }

            if (!game.player1.id) {
                game.player1.id = interaction.user.id;
                game.player1.openingPlayer = true;
            } else if (!game.player2.id && interaction.user.id !== game.player1.id) {
                game.player2.id = interaction.user.id;
            }

            const player = interaction.user.id === game.player1.id ? game.player1 : game.player2;

            const [row, col] = interaction.customId.split(',').map(Number);

            // Check if the cell is already occupied
            if (game.matrix[row][col] !== '-') {
                await interaction.reply({ content: "This cell is already occupied!", ephemeral: true });
                return;
            }

            // Update the previous mover to the current user
            game.previousMover = interaction.user.id;

            // Update player moves and game state
            game.updatePlayerMoves(player, row, col, interaction);
            game.matrix[row][col] = player === game.player1 ? "X" : "O";

            // Check for a winner
            if (game.checkWinner(player)) {
                const newLabel = player === game.player1 ? "X" : "O";
                await game.updateButtonLabel(interaction.message, row, col, newLabel);
                await interaction.update({ content: `${interaction.user.username} wins! :crown:` });
                game.emit('gameEnd');
                setTimeout(() => {
                    game.newChannel.delete()
                        .then(console.log(`Channel deleted after 3 seconds`))
                        .catch(console.error);
                }, 5000);
                return;
            }

            // Update the button label
            const newLabel = player === game.player1 ? "X" : "O";

            // Update the button in the action row
            await game.updateButtonLabel(interaction.message, row, col, newLabel);
            await interaction.deferUpdate();
        };

        const messageListener = async message => {
            const game = games.get(message.channel.id);
            if (!game) return; // No game found for this channel

            if (message.content.toLowerCase() === '!end') {
                game.emit('gameEnd');
            }
        };

        this.client.on('interactionCreate', interactionListener);
        this.client.on('messageCreate', messageListener);

        this.on('gameEnd', async () => {
            await this.newChannel.send(' :no_entry: Game has ended. :no_entry: ');
            // Remove the event listeners
            this.client.off('interactionCreate', interactionListener);
            this.client.off('messageCreate', messageListener);
        });

        games.set(this.newChannel.id, this);
    }
}

module.exports = XOXGame;
const fs = require('fs');
const path = require('path');
const countPath = path.join(__dirname, '../../database/calculator_componentsv2_count.json');
let calculatorV2Count = 0;
function loadV2Count() {
  try {
    if (fs.existsSync(countPath)) {
      const data = JSON.parse(fs.readFileSync(countPath, 'utf8'));
      if (typeof data.count === 'number') calculatorV2Count = data.count;
    }
  } catch (e) {
    calculatorV2Count = 0;
  }
}
function saveV2Count() {
  try {
    fs.writeFileSync(countPath, JSON.stringify({ count: calculatorV2Count }, null, 2));
  } catch (e) {}
}
loadV2Count();
const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  MessageFlags,
} = require("discord.js");
const {
  recommendationPack,
  calculateXpMessage,
} = require("../../events/calculator/calculator");

// Helper to build the result message as Discord Components v2 layout (ContainerBuilder/TextDisplayBuilder/SeparatorBuilder/ActionRowBuilder)
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ButtonStyle } = require("discord.js");
function buildCalculatorResultComponents(
  startLevel,
  targetLevel,
  xpRequired,
  recommendations,
  page,
  totalCount,
) {
  const timestamp = new Date().toLocaleString();
  let packText = '';
  const finance = require('../../utils/finance');
  if (recommendations && recommendations.length > 0) {
    const rec = recommendations[page] || recommendations[0];
    let priceBreakdown = finance.breakdownPriceWithEmoji ? finance.breakdownPriceWithEmoji(rec.totalPrice) : rec.totalPrice;
    packText = `## 📦 Pack Recommendations\n\nOption ${page + 1} of ${recommendations.length}: ${rec.packs}x ${rec.emoji || ''} ${rec.name}`;
    packText += `\n💰 Price: ${priceBreakdown}`;
    packText += `\n⚡ XP: ${rec.totalXp.toLocaleString()} XP`;
    packText += `\n⏰ Time: ${rec.totalTime} min`;
    if (rec.excessXp > 0) packText += `\n📊 Excess: +${rec.excessXp.toLocaleString()} XP`;
    packText += `\n\n-# Total calculator results sent: ${totalCount}`;
  } else {
    packText = `No pack recommendations available.\n\n-# Total calculator results sent: ${totalCount}`;
  }

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# 🧮 Calculation Result\n\nStart Level: ${startLevel} | Target Level: ${targetLevel} | Level Difference: ${targetLevel - startLevel}\n-# XP Required: ${xpRequired.toLocaleString()} XP`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(packText)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Previous')
            .setCustomId('calculator_prev')
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel('Next')
            .setCustomId('calculator_next')
            .setDisabled(page >= (recommendations && recommendations.length ? recommendations.length - 1 : 0))
        )
      )
  ];
}

// ...existing code...

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calculator')
    .setDescription('Open the level calculator modal.'),
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('calculator_modal')
      .setTitle('Level Calculator');

    const startLevelInput = new TextInputBuilder()
      .setCustomId('start_level')
      .setLabel('Start Level')
      .setPlaceholder('Enter your current level (1-124)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    const startXpInput = new TextInputBuilder()
      .setCustomId('start_xp')
      .setLabel('Start XP')
      .setPlaceholder('Enter your current XP')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(10);

    const targetLevelInput = new TextInputBuilder()
      .setCustomId('target_level')
      .setLabel('Target Level')
      .setPlaceholder('Enter your target level (2-125)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    const modalFirstRow = new ActionRowBuilder().addComponents(startLevelInput);
    const modalSecondRow = new ActionRowBuilder().addComponents(startXpInput);
    const modalThirdRow = new ActionRowBuilder().addComponents(targetLevelInput);

    modal.addComponents(modalFirstRow, modalSecondRow, modalThirdRow);
    await interaction.showModal(modal);
  },
  async handleModal(interaction) {
    if (interaction.customId !== 'calculator_modal') return;
    console.log('[calculator command] handleModal invoked by', interaction.user?.id);
    try {
      const startLevel = parseInt(interaction.fields.getTextInputValue('start_level'));
      const targetLevel = parseInt(interaction.fields.getTextInputValue('target_level'));

      if (isNaN(startLevel) || isNaN(targetLevel)) {
        return await interaction.reply({
          content: 'Please enter valid numbers for both levels.',
          flags: MessageFlags.Ephemeral
        });
      }
      if (startLevel <= 0 || targetLevel <= 0) {
        return await interaction.reply({
          content: 'Levels must be positive numbers.',
          flags: MessageFlags.Ephemeral
        });
      }
      if (startLevel >= targetLevel) {
        return await interaction.reply({
          content: 'Target level must be greater than start level.',
          flags: MessageFlags.Ephemeral
        });
      }
      if (targetLevel > 125) {
        return await interaction.reply({
          content: 'Target level cannot exceed 125.',
          flags: MessageFlags.Ephemeral
        });
      }

      const xpRequired = calculateXpMessage(startLevel, targetLevel);
      const recommendations = await recommendationPack(xpRequired, interaction.guild.id);
      let page = 0;
      calculatorV2Count++;
      saveV2Count();
      // Send as components v2 with pagination
      await interaction.reply({
        components: [
          ...buildCalculatorResultComponents(startLevel, targetLevel, xpRequired, recommendations, page, calculatorV2Count)
        ],
        flags: MessageFlags.IsComponentsV2
      });

      // Set up a collector for button interactions (pagination)
      const msg = await interaction.fetchReply();
      const filter = i => ['calculator_prev', 'calculator_next'].includes(i.customId) && i.user.id === interaction.user.id;
      const collector = msg.createMessageComponentCollector({ filter, time: 60_000 });

      collector.on('collect', async i => {
        if (i.customId === 'calculator_prev' && page > 0) page--;
        if (i.customId === 'calculator_next' && page < recommendations.length - 1) page++;
        await i.update({
          components: [
            ...buildCalculatorResultComponents(startLevel, targetLevel, xpRequired, recommendations, page, calculatorV2Count)
          ],
          flags: MessageFlags.IsComponentsV2
        });
      });

      collector.on('end', async () => {
        try {
          await msg.edit({ components: [] });
        } catch {}
      });
    } catch (error) {
      console.error('Error handling calculator modal:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error calculating the levels.',
          flags: MessageFlags.Ephemeral
        });
      } else {
        try {
          await interaction.followUp({
            content: 'There was an error calculating the levels.',
            flags: MessageFlags.Ephemeral
          });
        } catch (followUpError) {
          console.error('Failed to send follow-up error message:', followUpError);
        }
      }
    }
  }
};

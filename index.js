const fs = require("fs");
const config = require("./config.json");

// Function to get user-friendly error messages
function getErrorMessage(error) {
  if (error.code === 50007) {
    return "المستخدم أغلق الرسائل المباشرة";
  } else if (error.code === 50013) {
    return "البوت لا يملك صلاحية إرسال الرسائل";
  } else if (error.code === 50001) {
    return "البوت لا يملك صلاحية الوصول للمستخدم";
  } else if (error.code === 10003) {
    return "المستخدم غير موجود";
  } else if (error.code === 40001) {
    return "البوت غير مخول للوصول للمستخدم";
  } else if (error.code === 50035) {
    return "الرسالة غير صالحة";
  } else if (error.message && error.message.includes("Cannot send messages to this user")) {
    return "لا يمكن إرسال رسائل لهذا المستخدم";
  } else if (error.message && error.message.includes("Missing Permissions")) {
    return "البوت لا يملك الصلاحيات المطلوبة";
  } else {
    return `خطأ غير معروف: ${error.message || error.code || "خطأ غير محدد"}`;
  }
}

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  Partials,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.GuildMember],
});

client.once("ready", () => {
  console.log("Bot is Ready!");
  console.log("Code by Wick Studio");
  console.log("discord.gg/wicks");
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("-bc") || message.author.bot) return;

  const allowedRoleId = config.allowedRoleId;
  const member = message.guild.members.cache.get(message.author.id);

  if (!member.roles.cache.has(allowedRoleId)) {
    return message.reply({
      content: "ليس لديك صلاحية لاستخدام هذا الامر!",
      ephemeral: true,
    });
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply({
      content: "ليس لديك صلاحية لاستخدام هذا الامر!",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("لوحة تحكم البرودكاست")
    .setImage(config.image)
    .setDescription("الرجاء اختيار نوع الارسال للاعضاء.");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("send_all")
      .setLabel("ارسل للجميع")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("send_online")
      .setLabel("ارسل للمتصلين")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("send_offline")
      .setLabel("ارسل للغير المتصلين")
      .setStyle(ButtonStyle.Danger),
  );

  await message.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      let customId;
      if (interaction.customId === "send_all") {
        customId = "modal_all";
      } else if (interaction.customId === "send_online") {
        customId = "modal_online";
      } else if (interaction.customId === "send_offline") {
        customId = "modal_offline";
      }

      const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle("Type your message");

      const messageInput = new TextInputBuilder()
        .setCustomId("messageInput")
        .setLabel("اكتب رسالتك هنا")
        .setStyle(TextInputStyle.Paragraph);

      modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      const message = interaction.fields.getTextInputValue("messageInput");

      const guild = interaction.guild;
      if (!guild) return;

      await interaction.deferReply({
        ephemeral: true,
      });
      // Get status channel
      const statusChannel = guild.channels.cache.get(config.statusChannelId);
      if (!statusChannel) {
        return interaction.editReply({
          content: "❌ لم يتم العثور على قناة الحالة المحددة!",
        });
      }

      if (interaction.customId === "modal_all") {
        const membersToSend = guild.members.cache.filter(
          (member) => !member.user.bot
        );
        
        let successCount = 0;
        let failCount = 0;
        
        for (const member of membersToSend.values()) {
          try {
            await member.send({ content: `${message}\n<@${member.user.id}>`, allowedMentions: { parse: ['users'] } });
            
            // Send success status
            const successEmbed = new EmbedBuilder()
              .setColor("#00ff00")
              .setTitle("✅ تم إرسال الرسالة بنجاح")
              .setDescription(`**المستخدم:** ${member.user.tag} (<@${member.user.id}>)\n**الحالة:** تم التسليم بنجاح`)
              .setTimestamp();
            
            await statusChannel.send({ embeds: [successEmbed] });
            successCount++;
            
          } catch (error) {
            // Send failure status with reason
            const failEmbed = new EmbedBuilder()
              .setColor("#ff0000")
              .setTitle("❌ فشل في إرسال الرسالة")
              .setDescription(`**المستخدم:** ${member.user.tag} (${member.user.id})\n**السبب:** ${getErrorMessage(error)}`)
              .setTimestamp();
            
            await statusChannel.send({ embeds: [failEmbed] });
            failCount++;
            console.error(`Error sending message to ${member.user.tag}:`, error);
          }
        }
        
        // Send summary
        const summaryEmbed = new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle("📊 ملخص إرسال الرسائل - للجميع")
          .setDescription(`**إجمالي المستخدمين:** ${membersToSend.size}\n**نجح:** ${successCount}\n**فشل:** ${failCount}`)
          .setTimestamp();
        
        await statusChannel.send({ embeds: [summaryEmbed] });
        
      } else if (interaction.customId === "modal_online") {
        const onlineMembersToSend = guild.members.cache.filter(
          (member) =>
            !member.user.bot &&
            member.presence &&
            member.presence.status !== "offline"
        );
        
        let successCount = 0;
        let failCount = 0;
        
        for (const member of onlineMembersToSend.values()) {
          try {
            await member.send({ content: `${message}\n<@${member.user.id}>`, allowedMentions: { parse: ['users'] } });
            
            // Send success status
            const successEmbed = new EmbedBuilder()
              .setColor("#00ff00")
              .setTitle("✅ تم إرسال الرسالة بنجاح")
              .setDescription(`**المستخدم:** ${member.user.tag} (<@${member.user.id}>)\n**الحالة:** تم التسليم بنجاح`)
              .setTimestamp();
            
            await statusChannel.send({ embeds: [successEmbed] });
            successCount++;
            
          } catch (error) {
            // Send failure status with reason
            const failEmbed = new EmbedBuilder()
              .setColor("#ff0000")
              .setTitle("❌ فشل في إرسال الرسالة")
              .setDescription(`**المستخدم:** ${member.user.tag} (${member.user.id})\n**السبب:** ${getErrorMessage(error)}`)
              .setTimestamp();
            
            await statusChannel.send({ embeds: [failEmbed] });
            failCount++;
            console.error(`Error sending message to ${member.user.tag}:`, error);
          }
        }
        
        // Send summary
        const summaryEmbed = new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle("📊 ملخص إرسال الرسائل - للمتصلين")
          .setDescription(`**إجمالي المستخدمين:** ${onlineMembersToSend.size}\n**نجح:** ${successCount}\n**فشل:** ${failCount}`)
          .setTimestamp();
        
        await statusChannel.send({ embeds: [summaryEmbed] });
        
      } else if (interaction.customId === "modal_offline") {
        const offlineMembersToSend = guild.members.cache.filter(
          (member) =>
            !member.user.bot &&
            (!member.presence || member.presence.status === "offline")
        );
        
        let successCount = 0;
        let failCount = 0;
        
        for (const member of offlineMembersToSend.values()) {
          try {
            await member.send({ content: `${message}\n<@${member.user.id}>`, allowedMentions: { parse: ['users'] } });
            
            // Send success status
            const successEmbed = new EmbedBuilder()
              .setColor("#00ff00")
              .setTitle("✅ تم إرسال الرسالة بنجاح")
              .setDescription(`**المستخدم:** ${member.user.tag} (${member.user.id})\n**الحالة:** تم التسليم بنجاح`)
              .setTimestamp();
            
            await statusChannel.send({ embeds: [successEmbed] });
            successCount++;
            
          } catch (error) {
            // Send failure status with reason
            const failEmbed = new EmbedBuilder()
              .setColor("#ff0000")
              .setTitle("❌ فشل في إرسال الرسالة")
              .setDescription(`**المستخدم:** ${member.user.tag} (${member.user.id})\n**السبب:** ${getErrorMessage(error)}`)
              .setTimestamp();
            
            await statusChannel.send({ embeds: [failEmbed] });
            failCount++;
            console.error(`Error sending message to ${member.user.tag}:`, error);
          }
        }
        
        // Send summary
        const summaryEmbed = new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle("📊 ملخص إرسال الرسائل - للغير متصلين")
          .setDescription(`**إجمالي المستخدمين:** ${offlineMembersToSend.size}\n**نجح:** ${successCount}\n**فشل:** ${failCount}`)
          .setTimestamp();
        
        await statusChannel.send({ embeds: [summaryEmbed] });
      }
      await interaction.editReply({
        content: "✅ تم إرسال رسالتك إلى الأعضاء! تحقق من قناة الحالة لرؤية تفاصيل التسليم.",
      });
    }
  } catch (error) {
    console.error("Error in interactionCreate event:", error);
  }
});


client.login(config.TOKEN);

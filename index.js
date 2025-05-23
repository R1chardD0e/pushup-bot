require("dotenv").config();
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Регистрацуия участника
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const data = loadData();

  if (!data.users || !data.users[userId]) {
    addUser(userId, msg.from.first_name);
    bot.sendMessage(
      chatId,
      `👋 Привет, ${msg.from.first_name}! Ты зарегистрирован(а) в челендже!`
    );
    return;
  }
  bot.sendMessage(
    chatId,
    `👋 Привет, ${msg.from.first_name}! Ты уже зарегистрирован(а) в челендже!`
  );
});

// Подсчет отжиманий
bot.onText(/\/pushups\s+(\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const count = parseInt(match[1]);

  if (isNaN(count) || count <= 0) {
    bot.sendMessage(
      chatId,
      "❌ Введи количество отжиманий, например: /pushups 20"
    );
    return;
  }

  addUser(userId, msg.from.first_name);
  completePushups(userId, count);

  bot.sendMessage(
    chatId,
    `✅ Принято: ${msg.from.first_name} сделал(а) ${count} отжиманий!`
  );
});

// 📊 Общая статистика
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const data = loadData();

  if (!data.users || Object.keys(data.users).length === 0) {
    bot.sendMessage(chatId, "Нет данных об участниках.");
    return;
  }

  let message = "📊 Статистика:\n\n";
  for (const userId in data.users) {
    const user = data.users[userId];
    message += `${user.name} — ${user.total} отжиманий (долг: ${user.debt})\n`;
  }

  bot.sendMessage(chatId, message);
});

// 🙋 Индивидуальная статистика
bot.onText(/\/me/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const data = loadData();

  if (!data.users || !data.users[userId]) {
    bot.sendMessage(chatId, "Ты ещё не участвовал(а) в челендже.");
    return;
  }

  const user = data.users[userId];
  const message = `👤 ${user.name}\n\nВсего отжиманий: ${user.total}\nДолг: ${user.debt}`;
  bot.sendMessage(chatId, message);
});

// 🔄 Сброс своей статистики
bot.onText(/\/resetme/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const data = loadData();

  if (!data.users || !data.users[userId]) {
    bot.sendMessage(chatId, "Ты ещё не участвовал(а) в челендже.");
    return;
  }

  resetStats(userId);
  bot.sendMessage(chatId, "✅ Твоя статистика сброшена.");
});

// 🕘 Утренний и вечерний отчёты
cron.schedule("0 8 * * *", () => {
  console.log("⏰ Утренний отчёт");
  sendDailyReport();
});

cron.schedule("0 22 * * *", () => {
  console.log("🌙 Вечерний отчёт");
  sendDailyReport();
});

// ========== ФУНКЦИИ ==========

function loadData() {
  if (!fs.existsSync("data.json")) {
    fs.writeFileSync("data.json", JSON.stringify({ users: {}, currentDay: 1 }));
  }
  return JSON.parse(fs.readFileSync("data.json", "utf-8"));
}

function saveData(data) {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

function addUser(id, name) {
  const data = loadData();

  if (!data.users[id]) {
    data.users[id] = { name, total: 0, debt: 0 };
    console.log(`✅ Участник "${name}" добавлен!`);
    saveData(data);
  }
}

function completePushups(id, count) {
  const data = loadData();

  if (!data.users || !data.users[id]) {
    console.log(`❌ Участник с ID ${id} не найден.`);
    return;
  }

  const user = data.users[id];
  user.total += count;

  if (user.debt > 0) {
    const paid = Math.min(user.debt, count);
    user.debt -= paid;
    console.log(`✅ ${paid} отжиманий списано с долга.`);
  }

  console.log(
    `✅ ${user.name} сделал(а) ${count} отжиманий. Всего: ${user.total}`
  );
  saveData(data);
}

function resetStats(userId) {
  const data = loadData();

  if (!data.users[userId]) return;

  data.users[userId].total = 0;
  data.users[userId].debt = 0;
  saveData(data);
  console.log(`✅ Статистика для пользователя ${userId} сброшена.`);
}

function sendDailyReport() {
  const data = loadData();
  const today = new Date();
  const dayNumber =
    Math.floor((today - new Date("2025-05-09")) / (1000 * 60 * 60 * 24)) + 1;
  const requiredPushups = 10 + dayNumber - 1;

  let message = `📅 День ${dayNumber}: сегодня нужно сделать ${requiredPushups} отжиманий.\n\n`;

  for (const userId in data.users) {
    const user = data.users[userId];
    message += `${user.name} — долг: ${user.debt}, всего: ${user.total}\n`;
    user.debt += requiredPushups;
  }

  saveData(data);

  if (data.chatIds && data.chatIds.length > 0) {
    for (const chatId of data.chatIds) {
      bot.sendMessage(chatId, message);
    }
  } else {
    console.log("❗ Нет сохранённых chatId для рассылки.");
  }
}

function saveChatIdIfMissing(chatId) {
  const data = loadData();
  if (!data.chatIds) data.chatIds = [];

  if (!data.chatIds.includes(chatId)) {
    data.chatIds.push(chatId);
    saveData(data);
    console.log(`✅ Добавлен новый chatId: ${chatId}`);
  }
}

require("dotenv").config();
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text;

  addUser(userId, msg.from.first_name);

  if (!text) return;

  const match = text.match(/#pushups(\d+)/i); // ищем хэштег типа #pushups15

  if (match) {
    const count = parseInt(match[1]);
    completePushups(userId, count);

    bot.sendMessage(
      chatId,
      `✅ Принято: ${msg.from.first_name} сделал(а) ${count} отжиманий!`
    );
  }
});

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

  bot.sendMessage(chatId, message);
});

bot.onText(/\/resetMe/, (msg) => {
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

function loadData() {
  return JSON.parse(fs.readFileSync("data.json", "utf-8"));
}

function saveData(data) {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

function addUser(id, name) {
  const data = loadData();

  if (!data.users[id]) {
    data.users[id] = {
      name,
      total: 0,
      debt: 0,
    };
    console.log(`✅ Участник "${name}" добавлен!`);
    saveData(data);
  } else {
    console.log(`⚠️ Участник с ID ${id} уже есть.`);
  }
}

function completePushups(id, count) {
  const data = loadData();

  // Проверяем, есть ли такой участник
  if (!data.users || !data.users[id]) {
    console.log(`❌ Участник с ID ${id} не найден.`);
    return;
  }

  const user = data.users[id];
  user.total += count;

  // Уменьшаем долг, если он есть
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

  if (!data.users[userId]) {
    return;
  }

  data.users[userId].total = 0;
  data.users[userId].debt = 0;
  saveData(data);
  console.log(`✅ Статистика для пользователя ${userId} сброшена.`);
}

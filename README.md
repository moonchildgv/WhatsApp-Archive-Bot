# 📦 WhatsApp Archive Bot

This project is a **WhatsApp Web bot** that automatically archives chats after replying to them using the [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) library and Puppeteer.

It's useful for:
- Keeping your WhatsApp interface clean
- Automatically organizing conversations you've already responded to
- Avoiding accidental re-replies to the same person

---

## 🚀 Features

✅ Automatically listens for incoming messages  
✅ Detects if you’ve replied to a chat  
✅ Archives the chat **right after your reply**  
✅ Skips chats you haven’t replied to yet  
✅ Night mode for better resources and reconnection in the automatic morning  
✅ Uses persistent authentication (`.wwebjs_auth` folder)  
✅ Console logs for every action it performs  
✅ Compatible with **Node.js** and **Docker**

---

## 📸 How It Works

The script launches a headless browser using Puppeteer and connects to WhatsApp Web through `whatsapp-web.js`. It monitors incoming messages and, once you **send a reply manually**, it waits a few seconds and then **archives the chat automatically**.

The idea is to keep your WhatsApp clean while ensuring you don’t miss any new messages.

---

## 📁 Project Structure

```
whatsapp-archive-bot/
├── whatsapp-archive-bot.js       # Main bot logic
├── package.json                  
├── docker-compose.yml
├── Dockerfile                    
└── .wwebjs\_auth/                # WhatsApp auth session (generated after first run)
```

---

## 🧩 Requirements

### If using Node.js directly:
- Node.js 18+
- npm
- WhatsApp account with QR code access

### If using Docker:
- Docker installed on your machine
- Internet connection

---

## 🛠️ Installation & Usage

You can run the bot in **two ways**:

---

### 📍 Option 1: Node.js (Local)

#### Step 1: Clone the repository

```bash
git clone https://github.com/yourusername/whatsapp-archive-bot.git
cd whatsapp-archive-bot
````

#### Step 2: Install dependencies

```bash
npm install
```

#### Step 3: Run the bot

```bash
node whatsapp-archive-bot.js
```

> 📱 On first launch, a **QR code** will appear in the terminal. Scan it using WhatsApp on your phone.

#### Step 4: Keep it running

Use a process manager like `pm2` or `screen` if you want the bot to run in the background.

---

### 🐳 Option 2: Docker

#### Step 1: Clone the repository

```bash
git clone https://github.com/yourusername/whatsapp-archive-bot.git
cd whatsapp-archive-bot
```

#### Step 2: Build the Docker image

```bash
docker compose build
```

#### Step 3: Run the container

```bash
docker compose up
```

---

## ⚙️ Configuration

There’s no configuration file required. However, you can customize the script logic directly inside `whatsapp-archive-bot.js`:

* Change how long the bot waits before archiving (`setTimeout`)
* Add filters to ignore specific chats
* Extend to auto-respond or integrate with a database

---

## 📋TO-DO

- Outsourced configuration
- Memory use optimization

---

## 🔐 Authentication

The script saves your WhatsApp Web session in the `.wwebjs_auth/` directory after the first successful login. You won’t need to scan the QR code again unless this folder is deleted.

---

## 🧾 License

MIT — Feel free to use, modify, and distribute.

---

## 🙌 Credits

Built using:

* [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
* [Puppeteer](https://github.com/puppeteer/puppeteer)

---

## 💬 Contributing

Pull requests are welcome! If you find bugs or want to add features, feel free to fork and submit a PR.

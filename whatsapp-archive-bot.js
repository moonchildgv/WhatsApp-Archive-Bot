const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const client = new Client({
    authStrategy: new LocalAuth(), // Keeps the session active
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for running in a container
    }
});

let isConnected = false;
let qrScanned = false;
let qrTimeout = null;

// Generate QR code for authentication
client.on('qr', qr => {
    console.log('Scan this QR Code to access WhatsApp:');
    qrcode.generate(qr, { small: true });
    
    // Reset the QR timeout if it exists
    if (qrTimeout) {
        clearTimeout(qrTimeout);
    }
    
    // Set a timeout to check if QR was scanned
    qrTimeout = setTimeout(() => {
        if (!qrScanned) {
            console.log('⚠️ QR code not scanned within the timeout period.');
            console.log('🔄 Will try to reconnect later.');
            
            // Destroy the client to retry later
            client.destroy().then(() => {
                isConnected = false;
                console.log('❌ Disconnected due to QR timeout.');
            });
        }
    }, 2 * 60 * 1000); // 2 minutes timeout
});

// Handle successful authentication
client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
    qrScanned = true;
    
    if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
    }
});

// Handle when ready
client.on('ready', () => {
    console.log('🟢 WhatsApp client is ready!');
    isConnected = true;
    qrScanned = true;
});

// Handle disconnection
client.on('disconnected', (reason) => {
    console.log('🔴 WhatsApp client disconnected:', reason);
    isConnected = false;
    qrScanned = false;
});

// Save timestamps of sent messages for each chat
let lastMessageTimes = {};

// Function to wait
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to generate a random time
function getRandomTime(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// Check if a chat is pinned in home
async function isPinnedInHome(chat) {
    try {
        // Get all chats directly through the API
        let chats = await client.getChats();
        // Filter only those that are actually pinned
        let pinnedChats = chats.filter(c => c.pinned === true);
        // Check if current chat ID is among pinned chats
        return pinnedChats.some(c => c.id._serialized === chat.id._serialized);
    } catch (error) {
        console.error(`Error checking pinned chats:`, error);
        // When in doubt, better not archive
        return true;
    }
}

// Archive all groups at startup
async function archiveGroupsOnStartup() {
    try {
        // Get all NON-ARCHIVED chats (those in the home screen)
        const chats = await client.getChats();
        
        // Filter only groups in home (not archived)
        const groups = chats.filter(chat => chat.isGroup && !chat.archived);
        
        console.log(`👥 Found ${groups.length} groups in home`);
        let archivedCount = 0;
        let skippedCount = 0;
        
        // Check each group
        for (const group of groups) {
            // Get updated group to ensure you have the most recent data
            const updatedGroup = await client.getChatById(group.id._serialized);
            
            // Check if the group is pinned
            const isPinned = updatedGroup.pinned === true;
            
            // Check if there are unread messages using only unreadCount
            const hasUnread = updatedGroup.unreadCount > 0;
            
            if (!isPinned && !hasUnread) {
                console.log(`📂 Archiving group "${updatedGroup.name}" at startup...`);
                await updatedGroup.archive();
                archivedCount++;
                console.log(`✅ Group "${updatedGroup.name}" archived successfully`);
                
                // Small pause between operations to avoid rate limiting
                await sleep(1000);
            } else {
                skippedCount++;
                let reason = [];
                if (isPinned) reason.push('pinned');
                if (hasUnread) reason.push('has unread messages (unreadCount)');
                console.log(`⏩ Group "${updatedGroup.name}" skipped: ${reason.join(', ')}`);
            }
        }
        
        console.log(`📊 Summary: archived ${archivedCount} groups out of ${groups.length} total in home (${skippedCount} not archived)`);
    } catch (error) {
        console.error('❌ Error while archiving groups at startup:', error);
    }
}

// Function to connect and disconnect the bot randomly
async function manageConnection() {
    while (true) {
        // Generate random times for disconnection and reconnection
        const nightHour = 1; // Base night hour (1:00)
        const nightMinuteRandom = getRandomTime(1, 15); // Random minutes from 1 to 15
        
        const morningHour = 9; // Base morning hour (9:00)
        const morningMinuteRandom = getRandomTime(30, 45); // Random minutes from 30 to 45
        
        // Check if we are in night time (1:xx-9:xx with random minutes)
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Check if we are in night time
        const isNightTime = (currentHour > nightHour || (currentHour === nightHour && currentMinute >= nightMinuteRandom)) && 
                           (currentHour < morningHour || (currentHour === morningHour && currentMinute < morningMinuteRandom));
        
        if (isNightTime && isConnected) {
            // If it's night and we're connected, disconnect
            console.log(`🌙 Night time (1:${nightMinuteRandom.toString().padStart(2, '0')}-9:${morningMinuteRandom.toString().padStart(2, '0')}). Scheduled disconnection...`);
            
            // Empty the lastMessageTimes dictionary before disconnecting
            console.log("🗑️ Clearing sent messages cache...");
            const numEntries = Object.keys(lastMessageTimes).length;
            lastMessageTimes = {};
            console.log(`✅ Cache cleared (${numEntries} entries removed)`);
            
            await client.destroy();
            isConnected = false;
            console.log("❌ Disconnected for night time!");
            
            // Calculate time remaining until 9:xx in the morning
            const wakeupTime = new Date();
            wakeupTime.setHours(morningHour, morningMinuteRandom, 0, 0);
            if (wakeupTime <= now) {
                // If 9:xx has already passed today, set for tomorrow
                wakeupTime.setDate(wakeupTime.getDate() + 1);
            }
            
            const sleepMs = wakeupTime - now;
            const sleepMinutes = Math.floor(sleepMs / 60000);
            const sleepHours = Math.floor(sleepMinutes / 60);
            const remainingMinutes = sleepMinutes % 60;
            
            console.log(`💤 Night rest for ${sleepHours} hours and ${remainingMinutes} minutes...`);
            console.log(`🕒 Scheduled wake up at ${wakeupTime.toLocaleTimeString()}`);
            
            await sleep(sleepMs);
            continue; // Skip the rest of the cycle and restart from the beginning
        }
        
        if (isNightTime && !isConnected) {
            // If it's night and we're already disconnected, stay disconnected until 9:xx in the morning
            const wakeupTime = new Date();
            wakeupTime.setHours(morningHour, morningMinuteRandom, 0, 0);
            if (wakeupTime <= now) {
                // If 9:xx has already passed today, set for tomorrow
                wakeupTime.setDate(wakeupTime.getDate() + 1);
            }
            
            const sleepMs = wakeupTime - now;
            const sleepMinutes = Math.floor(sleepMs / 60000);
            const sleepHours = Math.floor(sleepMinutes / 60);
            const remainingMinutes = sleepMinutes % 60;
            
            console.log(`🌙 Night time (1:${nightMinuteRandom.toString().padStart(2, '0')}-9:${morningMinuteRandom.toString().padStart(2, '0')}). Maintaining disconnection...`);
            console.log(`💤 Night rest for ${sleepHours} hours and ${remainingMinutes} minutes...`);
            console.log(`🕒 Scheduled wake up at ${wakeupTime.toLocaleTimeString()}`);
            
            await sleep(sleepMs);
            continue; // Skip the rest of the cycle and restart from the beginning
        }
        
        // Normal behavior outside night time
        if (!isConnected) {
            console.log("🔄 Connecting to WhatsApp...");
            
            // Reset QR scan flag when trying to connect
            qrScanned = false;
            
            try {
                await client.initialize();
                
                // Wait for either connection or timeout
                let connectionCheckTime = 0;
                const maxWaitTime = 3 * 60 * 1000; // 3 minutes max wait
                const checkInterval = 5000; // Check every 5 seconds
                
                while (!isConnected && connectionCheckTime < maxWaitTime) {
                    await sleep(checkInterval);
                    connectionCheckTime += checkInterval;
                    
                    // If we've been waiting a while and QR wasn't scanned
                    if (connectionCheckTime >= 30000 && !qrScanned) {
                        console.log("⚠️ Still waiting for QR code to be scanned...");
                    }
                }
                
                if (!isConnected) {
                    console.log("❌ Failed to connect within timeout period.");
                    await client.destroy();
                    // Wait 5 minutes before trying again
                    console.log("⏳ Waiting 5 minutes before trying again...");
                    await sleep(5 * 60 * 1000);
                    continue;
                }
                
                console.log("✅ Connected!");
                
                await sleep(5000); // Wait 5 seconds to stabilize the connection

                // At startup, archive all groups that are not pinned and have no unread messages
                console.log("🔍 Checking groups to archive at startup...");
                await archiveGroupsOnStartup();
            } catch (error) {
                console.error("❌ Error connecting to WhatsApp:", error);
                console.log("⏳ Waiting 5 minutes before trying again...");
                await sleep(5 * 60 * 1000);
                continue;
            }
        }
        
        // Calculate time remaining until 1:xx (night disconnection time)
        const nightTime = new Date();
        nightTime.setHours(nightHour, nightMinuteRandom, 0, 0); // Set to 1:xx
        if (nightTime <= now) {
            // If 1:xx has already passed today, set for tomorrow
            nightTime.setDate(nightTime.getDate() + 1);
        }
        
        // Calculate time in milliseconds until 1:xx
        const timeUntilNight = nightTime - now;
        // Convert to minutes
        const minutesUntilNight = Math.floor(timeUntilNight / 60000);
        const hoursUntilNight = Math.floor(minutesUntilNight / 60);
        const remainingMinutesUntilNight = minutesUntilNight % 60;
        
        console.log(`📡 I will stay connected until night time (1:${nightMinuteRandom.toString().padStart(2, '0')}).`);
        console.log(`⏳ Time remaining: ${hoursUntilNight} hours and ${remainingMinutesUntilNight} minutes`);
        console.log(`🕒 Scheduled disconnection at ${nightTime.toLocaleTimeString()}`);
        
        // Run periodic archive checks every hour while connected
        const hourCheckInterval = 60; // minutes
        
        // If more than an hour remains, perform periodic checks
        if (minutesUntilNight > hourCheckInterval) {
            let timeRemaining = minutesUntilNight;
            
            // Loop of hourly checks until night time
            while (timeRemaining > hourCheckInterval) {
                console.log(`⏳ Waiting ${hourCheckInterval} minutes before next group check...`);
                await sleep(hourCheckInterval * 60 * 1000);
                
                // Check if we're still connected (status might have changed)
                if (!isConnected) break;
                
                console.log("🔍 Periodic group check...");
                await archiveGroupsOnStartup();
                
                // Update remaining time
                timeRemaining -= hourCheckInterval;
                console.log(`⌛ Time remaining before night time: ${Math.floor(timeRemaining / 60)} hours and ${timeRemaining % 60} minutes`);
            }
            
            // If we exited the loop but are still connected, wait the remaining time
            if (isConnected && timeRemaining > 0) {
                console.log(`⏳ Waiting the final ${timeRemaining} minutes before night time...`);
                await sleep(timeRemaining * 60 * 1000);
            }
        } else {
            // If less than an hour remains, wait directly
            console.log(`⏳ Waiting ${minutesUntilNight} minutes before night time...`);
            await sleep(minutesUntilNight * 60 * 1000);
        }
        
        // There will be a new cycle that will check again if it's night time
        // and will handle disconnection if necessary
    }
}

// Check if the chat should be archived
async function checkAndArchiveChat(chat) {
    try {
        // Get the fully updated chat object
        chat = await client.getChatById(chat.id._serialized);
        
        // If the chat is already archived, do nothing
        if (chat.archived) {
            console.log(`🗄️ Chat "${chat.name}" is already archived.`);
            return;
        }
        
        // Check if the chat is pinned (both directly and in home)
        const chatIsPinned = chat.pinned === true;
        const chatIsPinnedInHome = await isPinnedInHome(chat);
        
        if (chatIsPinned || chatIsPinnedInHome) {
            console.log(`📌 Chat "${chat.name}" is pinned (${chatIsPinned ? 'locally' : 'in home'}), it will not be archived.`);
            return;
        }
        
        // Check if there are unread messages with direct check
        const hasUnread = chat.unreadCount > 0;
        
        if (hasUnread) {
            console.log(`🔔 Chat "${chat.name}" has unread messages, it will not be archived.`);
            return;
        }
        
        // Special treatment for groups: archive them directly if they have no unread messages
        if (chat.isGroup) {
            console.log(`👥 Group "${chat.name}" will be archived directly.`);
            await chat.archive();
            console.log(`✅ Group "${chat.name}" archived successfully.`);
            return;
        }

        // For individual chats, continue with existing logic
        // Retrieve the last message sent in this chat
        let lastMessageTime = lastMessageTimes[chat.id._serialized];
        if (!lastMessageTime) return;
        
        // Get the last 5 messages from the chat
        let messages = await chat.fetchMessages({ limit: 5 });
        
        // Find a message received AFTER my last message
        let responseFound = messages.some(msg => !msg.fromMe && msg.timestamp > lastMessageTime);
        
        if (responseFound) {
            console.log(`📨 Chat "${chat.name}" has received a reply, it will not be archived.`);
        } else {
            console.log(`📂 Archiving chat "${chat.name}" in progress...`);
            await chat.archive();
            console.log(`✅ Chat "${chat.name}" archived successfully.`);
        }
    } catch (error) {
        console.error(`❌ Error during chat check "${chat.name}":`, error);
    }
}

// Event for each sent message
client.on('message_create', async (message) => {
    if (message.fromMe) {
        let chat = await message.getChat();
        // Save the timestamp of the last message sent in the chat
        lastMessageTimes[chat.id._serialized] = message.timestamp;
        console.log(`✉️ Message sent in chat: "${chat.name}"`);
        // Check after 5 seconds
        setTimeout(() => checkAndArchiveChat(chat), 5000);
    }
});


manageConnection();
require('dotenv').config();
const {Client, MessageEmbed, GatewayIntentBits, ActivityType} = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const cron = require('node-cron');

const { TOKEN, VOICE_CHANNEL_ID, GUILD_ID, TEXT_CHANNEL_ID, MATCH_DINGS_WITH_HOUR } = process.env;

const DClient = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
	  ]
});

let guild, voiceChannel, textChannel ;

// When bot comes online check the guild and voice channel are valid
// if they are not found the program will exit
DClient.on('ready', async () => {
	try {
		guild = await DClient.guilds.fetch(GUILD_ID);
		voiceChannel = guild.channels.cache.get(VOICE_CHANNEL_ID);
	} catch (error) {
		console.log(error);
		process.exit(1);
	}
	textChannel = guild.channels.cache.get(TEXT_CHANNEL_ID);
	console.log('Big Ben Ready...');
	DClient.user.setPresence({
		activities: [{ name: `the hour`, type: ActivityType.Watching }],
		status: 'idle',
	  });
});

// use node-cron to create a job to run every hour
const task = cron.schedule('0 0 */1 * * *', async () => {
	let { hour, amPm, timezoneOffsetString } = getTimeInfo();

	// if text channel was defined send message in chat
	if (textChannel) {
		const messageEmbed = new MessageEmbed()
		.setColor('#FFD700')
		.setTitle(`The time is now ${hour}:00 ${amPm} GMT${timezoneOffsetString}`)
		
		textChannel.send(messageEmbed);
	}

	// check if VC defined in config is empty
	if (voiceChannel.members.size >= 1) {
		try {
			DClient.user.setPresence({
				activities: [{ name: `the bell`, type: ActivityType.Playing }],
				status: 'available',
			  });
			// connect to voice channel
			const connection = joinVoiceChannel({
				channelId: VOICE_CHANNEL_ID,
				guildId: GUILD_ID,
				adapterCreator: guild.voiceAdapterCreator,
			});
			// counter for looping
			let count = 1;
		
			// immediately invoked function that loops to play the bell sound 
			(function play(DClient) {
				const player = createAudioPlayer({
					behaviors: {
						noSubscriber: NoSubscriberBehavior.Pause,
					},
				});
				const resource = createAudioResource('bigben.mp3');
				player.play(resource);
				connection.subscribe(player);
				player.on(AudioPlayerStatus.Idle, () => {
					count += 1;
					if (count <= hour && MATCH_DINGS_WITH_HOUR == 'true') {
						const resource = createAudioResource('bigben.mp3');
						player.play(resource);
					}
					else
					{
						connection.disconnect();
					}
				});
			})();
			DClient.user.setPresence({
				activities: [{ name: `the hour`, type: ActivityType.Watching }],
				status: 'idle',
			  });

		} catch(error) {
			console.log(error);
		}
	}
});

// function to get current time and return object containing
// hour and if it is am or pm
const getTimeInfo = () => {
		let time = new Date();
		let hour = time.getHours() >= 12 ? time.getHours() - 12 : time.getHours();
		hour = hour === 0 ? 12 : hour;
		let amPm = time.getHours() >= 12 ? 'PM' : 'AM';
		// get gmt offset in minutes and convert to hours
		let gmtOffset = time.getTimezoneOffset() / 60
		// turn gmt offset into a string representing the timezone in its + or - gmt offset
		let timezoneOffsetString = `${gmtOffset > 0 ? '-':'+'} ${Math.abs(gmtOffset)}`;

	return {
		hour,
		amPm,
		timezoneOffsetString
	}
}

// start the cron job
task.start();

DClient.login(TOKEN);

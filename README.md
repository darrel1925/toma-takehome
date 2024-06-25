# Toma takehome

Project demo --> https://youtu.be/my9hWdqB27o

### Get started
Cd into directory
```
cd ./toma-takehome
```

Install packages
```
bun install 
```

Install homeBrew dependencies (for microphone use)
```
brew install sox
```

Start program
```
bun start
```

Other considerations
1. Ensure your file is named `.env` with the "." when you drag and drop
2. You must have typescript installed `npm install -g typescript` or `brew install typescript`
3. The first time you run the application, you may be asked to allow permission to your microphone. If this happens, restart the app.
4. This was only tested on a Mac. Try using a mac if you run into trouble.


### Code references
1. Text-to-speech API: [link](https://github.com/darrel1925/toma-takehome/blob/main/clients/deepgram.ts#L93-L130)
2. Speech-to-text API: [link](https://github.com/darrel1925/toma-takehome/blob/main/clients/deepgram.ts#L28-L91)
3. Convert audio to 8kHz mulaw: [link](https://github.com/darrel1925/toma-takehome/blob/main/service/waveFileService.ts#L5-L32)

### Notes
• I did not use together AI's LLM's API. I used OpenAI's because GPT-4o was easier to work with.


:)

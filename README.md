# Toma takehome

Project demo --> https://youtu.be/my9hWdqB27o
Environment variables --> https://drive.google.com/file/d/15lzuCEtkxo6XrLeEbkKD-29aTHjp5go5/view?usp=sharing

## Get started
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

Other debugging tips
1. Ensure your file is named `.env` with the "." when you drag and drop
2. You must have typescript installed `npm install -g typescript` or `brew install typescript`
3. The first time you run the application, you may be asked to allow permission to your microphone. If this happens, restart the app.
4. This was only tested on a Mac. Try using a mac if you run into trouble.


## Code references
1. Text-to-speech API: [link](https://github.com/darrel1925/toma-takehome/blob/main/clients/deepgram.ts#L93-L130)
2. Speech-to-text API: [link](https://github.com/darrel1925/toma-takehome/blob/main/clients/deepgram.ts#L28-L91)
3. Convert audio to 8kHz mulaw: [link](https://github.com/darrel1925/toma-takehome/blob/main/service/waveFileService.ts#L5-L32)

## How it works
I have predefined "[intents](https://github.com/darrel1925/toma-takehome/blob/main/service/voiceAgent.ts#L133-L188)". Each intent has a corresponding [prompt](https://github.com/darrel1925/toma-takehome/blob/main/utils/prompts.ts#L81-L83) that is used to guide the LLM's conversation. 

The assistant identifies the intent of each user's message. We use that intent to provide additional context to the model for the next conversation step. This is how I keep the model on track throughout the conversation.

For example:
1. The user says: "I want an oil change".
2. The assistant identifies the message's intent as `OIL_CHANGE`.
3. This `intent` is parsed from the Assistant's response.
4. Then, we provide the assistant with information about oil changes for the next conversation step.

The brain of the program is [here](https://github.com/darrel1925/toma-takehome/blob/main/service/voiceAgent.ts#L133-L188).

## Notes
• I did not use together AI's LLM's API. I used OpenAI's because GPT-4o was easier to work with.


:)

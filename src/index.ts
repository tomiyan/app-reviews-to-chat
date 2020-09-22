import commandLineArgs from "command-line-args";
import { Config } from "./config";
import { AppStore } from "./reviews/app-store";
import { GooglePlay } from "./reviews/google-play";
import { State } from "./state/state";
import { File } from "./state/storage/file";
import { Constants } from "./constants";
import { Database } from "./state/storage/database";

const optionDefnitions: commandLineArgs.OptionDefinition[] = [
    { name: 'config', alias: 'c', type: String, defaultOption: true }
];

const options = commandLineArgs(optionDefnitions);
const config = new Config(options.config);

async function main() {
    let storage;
    if (config.common.storage === 'file') {
        storage = new File(config.common);
    } else {
        storage = new Database(config.common);
    }
    const state = new State(config.common, await storage.isFirstRun(), await storage.read());
    for (let appConf of config.appStoreApps) {
        const appStore = new AppStore(config.common, appConf, state);
        await appStore.startReview();
    }
    
    for (let appConf of config.googlePlayApps) {
        const googlePlay = new GooglePlay(config.common, appConf, state);
        await googlePlay.startReview();
    }
    await storage.save(state.state);
}

async function loop() {
    const interval = config.common.interval || Constants.DEFAULT_INTERVAL_SECONDS;
    while(true) {
        try {
            await main();
        } catch (error) {
            console.error(error);
        }
        await delay(interval * 1000);
    }
}

async function delay(ms: number) {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

loop();

// TODO: GitHub Actions ESLint
// TODO: GitHub Actions npm publish
// TODO: 別のチャット
// TODO: add help
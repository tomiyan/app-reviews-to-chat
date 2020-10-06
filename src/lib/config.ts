import * as fs from "fs";
import * as path from "path";
import { Constants } from "./constants";

export interface App {
    botIcon: string | undefined;
    showAppIcon: boolean;
    channel: string | undefined;
    appId: string;
    appName: string;
}

export interface AppStore extends App {
    regions: false | string[];
}

export interface GooglePlay extends App {
    publisherJson: object;
}

export interface Common {
    interval: number;
    slackHook: string;
    verbose: boolean;
    dryRun: boolean;
    storage: string;
}

export class Config {
    private _common: Common;
    private _appStoreApps: AppStore[];
    private _googlePlayApps: GooglePlay[];

    constructor(configPath: string) {
        const file = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../', configPath), 'utf8'));
        this._common = {
            slackHook: file.slackHook,
            verbose: file.verbose,
            dryRun: file.dryRun,
            interval: file.interval || Constants.DEFAULT_INTERVAL_SECONDS,
            storage: file.storage,
        };

        this._appStoreApps = [];
        this._googlePlayApps = [];
        for (let i = 0; i < file.appStoreApps?.length; i++) {
            const app = file.appStoreApps[i];
            this._appStoreApps.push({
                botIcon: app.botIcon || file.botIcon,
                showAppIcon: app.showAppIcon || file.showAppIcon || false,
                channel: app.channel || file.channel,
                appId: app.appId,
                appName: app.appName,
                regions: app.regions || false,
            });
        }
        for (let i = 0; i < file.googlePlayApps?.length; i++) {
            const app = file.googlePlayApps[i];
            let publisherJson;
            try {
                if (app.hasOwnProperty('publisherKey')) {
                    publisherJson = JSON.parse(fs.readFileSync(app.publisherKey, 'utf-8'));
                } else {
                    publisherJson = JSON.parse(process.env[app.publisherEnv]!);
                }
            } catch(e) {
                console.warn(e);
            }
            this._googlePlayApps.push({
                botIcon: app.botIcon || file.botIcon,
                showAppIcon: app.showAppIcon || file.showAppIcon || false,
                channel: app.channel || file.channel,
                publisherJson: publisherJson,
                appId: app.appId,
                appName: app.appName,
            });
        }
    }

    get common() {
        return this._common;
    }

    get appStoreApps() {
        return this._appStoreApps;
    }

    get googlePlayApps() {
        return this._googlePlayApps;
    }
}
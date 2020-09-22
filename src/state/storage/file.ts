import * as fs from "fs";
import { Common } from "../../config";
import { StateStorage } from "./state-storage";

export class File implements StateStorage {
    private static readonly FILE_PATH = './published_reviews.json';

    constructor(private common: Common) {}

    async isFirstRun(): Promise<boolean> {
        return !fs.existsSync(File.FILE_PATH);
    }

    async read(): Promise<Map<string, string[]>> {
        const map = new Map<string, string[]>();
        if (await this.isFirstRun()) {
            return map;
        }
        const apps = JSON.parse(fs.readFileSync(File.FILE_PATH, 'utf-8'));

        for (let key of Object.keys(apps)) {
            const value = apps[key];
            map.set(key, value);
        }
        return map;
    }

    async save(state: Map<string, string[]>): Promise<void> {
        const obj = [...state].reduce((l,[k,v]) => Object.assign(l, {[k]:v}), {})
        fs.writeFileSync(File.FILE_PATH, JSON.stringify(obj), { flag: 'w' })
    }
}
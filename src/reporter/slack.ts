import { Common } from "../config";
import { Data } from "./data";
const bent = require("bent");

export class Slack {
    constructor(
        private readonly commonConf: Common,
    ) {}

    async post(data: Data): Promise<void> {
        if (this.commonConf.verbose) {
            console.log(`INFO: Creating message for review ${data.title}`);
        }

        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < data.rating ? '★' : '☆';
        }
    
        const color = data.rating >= 4 ? 'good' : (data.rating >= 2 ? 'warning' : 'danger');
    
        let text = '';
        text += data.text + "\n";
    
        let footer = '';
        if (data.version) {
            footer += `for v${data.version}`;
        }

        if (data.osVersion) {
            footer += ` OS ${data.osVersion}`;
        }

        let appName = `${data.appName}, ${data.storeName}`;
        if (data.region) {
            appName += ` (${data.region})`;
        }

        if (data.link) {
            footer += ` - <${data.link}|${appName}>`;
        } else {
            footer += ` - ${appName}`;
        }
    
        let title = stars;
        if (data.title) {
            title += ` - ${data.title}`;
        }

        const messageJSON = JSON.stringify({
            'channel': data.channel,
            'attachments': [
                {
                    "mrkdwn_in": ["text", "pretext", "title"],
                    "color": color,
                    "author_name": data.author,
                    "thumb_url": data.icon,
                    "title": title,
                    "text": text,
                    "footer": footer
                }
            ]
        });
        if (this.commonConf.verbose) {
            console.log(`INFO: Posting new message to Slack: `);
            console.log(`INFO: Hook: ${this.commonConf.slackHook}`);
            console.log(`INFO: Message: ${messageJSON}`);
        }

        const post = bent('POST');
        await post(this.commonConf.slackHook, messageJSON, {'content-type': 'application/json'});
    }
}
import { Common as CommonConf, GooglePlay as AppStoreConf } from "../config";
import { State } from "../state/state";
import { Slack } from "../reporter/slack";
import { google } from "googleapis";
import * as playScraper from "google-play-scraper";
import { Data } from "../reporter/data";
const bent = require("bent");
const androidVersions = require("android-versions");

export class AppInformation {
    constructor(
        readonly appName: string,
        readonly appIcon: string,
    ) {}
}

export class GooglePlay {
    constructor(
        private readonly commonConf: CommonConf,
        private readonly appStoreConf: AppStoreConf,
        private readonly state: State,
    ) {}

    async startReview(): Promise<void> {
        const appInformation = await this.fetchAppInformation();
        const reviews = await this.fetchAppStoreReviews(appInformation);
        if (this.state.isFirstRun()) {
            for (const review of reviews) {
                this.state.markReviewAsPublished(this.appStoreConf.appId, review.id);
            }

            if (this.commonConf.dryRun && reviews.length > 0) {
                // Force publish a review if we're doing a dry run
                await this.publishReview(appInformation, reviews[reviews.length - 1], this.commonConf.dryRun);
            }
        } else {
            await this.handleFetchedAppStoreReviews(appInformation, reviews);
        }
    }

    private async fetchAppInformation(): Promise<AppInformation> {
        try {
            const data = await playScraper.app({appId: this.appStoreConf.appId});
            return new AppInformation(
                this.appStoreConf.appName || data.title,
                data.icon,
            );
        } catch (error) {
            if (this.commonConf.verbose) {
                console.log(`ERROR: Error fetching app data from Google Play for (${this.appStoreConf.appId})`);
                console.log(error);
            }
            return await Promise.reject(error);
        }
    }

    private async fetchAppStoreReviews(appInformation: AppInformation): Promise<Data[]> {
        let allReviews: Data[] = [];
        const scopes = ['https://www.googleapis.com/auth/androidpublisher'];
        const tokens = new google.auth.GoogleAuth({ scopes : scopes, credentials: this.appStoreConf.publisherJson });
        try {
            const response = await google.androidpublisher('v3').reviews.list({ auth: tokens, packageName: this.appStoreConf.appId, startIndex: 1, maxResults: 100 });
            if (this.commonConf.verbose) {
                console.log(`INFO: [${this.appStoreConf.appId}] Received reviews from Google Play`);
            }
            if (!response.data.reviews) {
                return allReviews;
            }
            for (let review of response.data.reviews) {
                const comment = review.comments![0].userComment;
                const osVersionInfo = androidVersions.get(comment?.androidOsVersion!);
                let device = undefined;
                if (comment?.deviceMetadata?.productName) {
                    device = comment?.deviceMetadata.productName;
                }
                allReviews.push({
                    id: review.reviewId!,
                    version: comment?.appVersionName!,
                    osVersion: osVersionInfo.semver,
                    device: device,
                    title: undefined,
                    text: comment?.text!,
                    rating: comment?.starRating!,
                    author: review.authorName!,
                    link: `https://play.google.com/store/apps/details?id=${this.appStoreConf.appId}&reviewId=${review.reviewId}`,
                    storeName: 'Google Play',
                    channel: this.appStoreConf.channel,
                    appName: this.appStoreConf.appName,
                    icon: this.appStoreConf.showAppIcon ? appInformation.appIcon : this.appStoreConf.botIcon,
                    region: undefined,
                });
            }
        } catch (error) {
            console.error(`ERROR: [${this.appStoreConf.appId}] Could not fetch Google Play reviews, ${error}`);
            return Promise.reject(error);
        }
        return Promise.resolve(allReviews);
    };

    private async publishReview(appInformation: AppInformation, review: Data, force: boolean) {
        if (!this.state.isReviewPublished(this.appStoreConf.appId, review.id) || force) {
            if (this.commonConf.verbose) {
                console.log(`INFO: Received new review: ${JSON.stringify(review)}`);
            }
            const slack = new Slack(this.commonConf);
            await slack.post(review);
            this.state.markReviewAsPublished(this.appStoreConf.appId, review.id);
        } else {
            if (this.commonConf.verbose) {
                console.log(`INFO: Review already published: ${review.text}`);
            }
        }
    }

    private async handleFetchedAppStoreReviews(appInformation: AppInformation, reviews: Data[]) {
        if (this.commonConf.verbose) {
            console.log(`INFO: [${this.appStoreConf.appId}] Handling fetched reviews`);
        }
        for (let review of reviews) {
            await this.publishReview(appInformation,  review, false)
        }
    };
}
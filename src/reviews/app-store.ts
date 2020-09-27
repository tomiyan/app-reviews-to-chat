import * as fs from 'fs';
import {Common as CommonConf, AppStore as AppStoreConf} from '../config';
import {State} from '../state/state';
import {Slack} from '../reporter/slack';
import {Data} from '../reporter/data';
const bent = require('bent');

export class AppInformation {
  constructor(
    readonly appName: string,
    readonly appIcon: string,
    readonly appLink: string,
  ) {}
}

export class AppStore {
  constructor(
    private readonly commonConf: CommonConf,
    private readonly appStoreConf: AppStoreConf,
    private readonly state: State,
  ) {}

  async startReview(): Promise<void> {
    let regions: string[];
    if (this.appStoreConf.regions === false) {
      regions = JSON.parse(fs.readFileSync('../regions.json', 'utf8'));
    } else {
      regions = this.appStoreConf.regions;
    }
    const appInformation = await this.fetchAppInformation();
    for (const region of regions) {
      const reviews = await this.fetchAppStoreReviews(region, appInformation);
      if (this.state.isFirstRun()) {
        for (const review of reviews) {
          this.state.markReviewAsPublished(this.appStoreConf.appId, review.id);
        }

        if (this.commonConf.dryRun && reviews.length > 0) {
          // Force publish a review if we're doing a dry run
          await this.publishReview(
            region,
            appInformation,
            reviews[reviews.length - 1],
            this.commonConf.dryRun,
          );
        }
      } else {
        await this.handleFetchedAppStoreReviews(
          region,
          appInformation,
          reviews,
        );
      }
    }
  }

  private async fetchAppInformation(): Promise<AppInformation> {
    const url = `https://itunes.apple.com/lookup?id=${this.appStoreConf.appId}`;
    const getJson = bent('json');
    try {
      const data = await getJson(url);
      const entries: any[] = data.results; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (entries == null || entries.length === 0) {
        if (this.commonConf.verbose) {
          console.log(
            `INFO: Received no data from App Store for (${this.appStoreConf.appId})`,
          );
        }
        return await Promise.reject(
          new Error(
            `INFO: Received no data from App Store for (${this.appStoreConf.appId})`,
          ),
        );
      }
      if (this.commonConf.verbose) {
        console.log(
          `INFO: Received data from App Store for (${this.appStoreConf.appId})`,
        );
      }
      const entry = entries[0];
      return new AppInformation(
        this.appStoreConf.appName || entry.trackCensoredName,
        entry.artworkUrl100,
        entry.trackViewUrl,
      );
    } catch (error) {
      if (this.commonConf.verbose) {
        console.log(
          `ERROR: Error fetching app data from App Store for (${this.appStoreConf.appId})`,
        );
        console.log(error);
      }
      return Promise.reject(error);
    }
  }

  private async fetchAppStoreReviews(
    region: string,
    appInformation: AppInformation,
  ): Promise<Data[]> {
    let allReviews: Data[] = [];
    for (let page = 1; page < 10; page++) {
      const reviews = await this.fetchAppStoreReviewsByPage(
        region,
        appInformation,
        page,
      );
      if (reviews.length === 0) {
        return Promise.resolve(allReviews);
      }
      allReviews = allReviews.concat(reviews);
    }
    return Promise.resolve(allReviews);
  }

  private async fetchAppStoreReviewsByPage(
    region: string,
    appInformation: AppInformation,
    page: number,
  ): Promise<Data[]> {
    const url = `https://itunes.apple.com/${region}/rss/customerreviews/page=${page}/id=${this.appStoreConf.appId}/sortBy=mostRecent/json`;
    const getJson = bent('json');
    try {
      const rss = await getJson(url);
      const entries = rss.feed.entry;
      if (entries == null || entries.length === 0) {
        if (this.commonConf.verbose) {
          console.log(
            `INFO: Received no reviews from App Store for (${this.appStoreConf.appId}) (${region})`,
          );
        }
        return await Promise.resolve([]);
      }
      console.log(
        `INFO: Received reviews from App Store for (${this.appStoreConf.appId}) (${region})`,
      );
      const that = this; // eslint-disable-line @typescript-eslint/no-this-alias
      const reviews = entries
        .filter(function (review: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          return !review.hasOwnProperty('im:name'); // eslint-disable-line no-prototype-builtins
        })
        .reverse()
        .map(function (review: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          return that.parseAppStoreReview(region, review, appInformation);
        });
      return Promise.resolve(reviews);
    } catch (error) {
      if (this.commonConf.verbose) {
        console.log(
          `ERROR: Error fetching reviews from App Store for (${this.appStoreConf.appId}) (${region})`,
        );
        console.log(error);
      }
      return Promise.resolve([]);
    }
  }

  private parseAppStoreReview(
    region: string,
    rssItem: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    appInformation: AppInformation,
  ): Data {
    return {
      id: rssItem.id.label,
      version: this.reviewAppVersion(rssItem),
      title: rssItem.title.label,
      text: rssItem.content.label,
      rating: this.reviewRating(rssItem),
      author: this.reviewAuthor(rssItem),
      link: this.reviewLink(rssItem),
      storeName: 'App Store',
      channel: this.appStoreConf.channel,
      appName: this.appStoreConf.appName || appInformation.appName,
      osVersion: undefined,
      icon: this.appStoreConf.showAppIcon
        ? appInformation.appIcon
        : this.appStoreConf.botIcon,
      region: region,
      device: undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reviewRating(review: any) {
    return review['im:rating'] && !isNaN(review['im:rating'].label)
      ? parseInt(review['im:rating'].label)
      : -1;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reviewAuthor(review: any) {
    return review.author ? review.author.name.label : '';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reviewLink(review: any) {
    return review.author ? review.author.uri.label : '';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reviewAppVersion(review: any) {
    return review['im:version'] ? review['im:version'].label : '';
  }

  private async publishReview(
    region: string,
    appInformation: AppInformation,
    review: Data,
    force: boolean,
  ) {
    if (
      !this.state.isReviewPublished(this.appStoreConf.appId, review.id) ||
      force
    ) {
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

  private async handleFetchedAppStoreReviews(
    region: string,
    appInformation: AppInformation,
    reviews: Data[],
  ) {
    if (this.commonConf.verbose) {
      console.log(
        `INFO: [${this.appStoreConf.appId} (${region})] Handling fetched reviews`,
      );
    }
    for (const review of reviews) {
      await this.publishReview(region, appInformation, review, false);
    }
  }
}

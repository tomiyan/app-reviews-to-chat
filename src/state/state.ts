import {Common} from '../config';
import {Constants} from '../constants';

export class State {
  constructor(
    private readonly common: Common,
    private readonly firstRun: boolean,
    readonly state: Map<string, string[]>,
  ) {}

  markReviewAsPublished(appId: string, reviewId: string): void {
    if (!this.state.has(appId)) {
      this.state.set(appId, []);
    }
    if (this.isReviewPublished(appId, reviewId)) {
      return;
    }
    let appState = this.state.get(appId) ?? [];
    const length = appState.length;
    if (this.common.verbose) {
      console.log(
        `INFO: Checking if we need to prune published reviews have (${length}) limit (${Constants.REVIEWS_LIMIT})`,
      );
    }
    if (length >= Constants.REVIEWS_LIMIT) {
      appState = appState.slice(0, Constants.REVIEWS_LIMIT);
    }
    appState.unshift(reviewId);
    if (this.common.verbose) {
      console.log(
        'INFO: Review marked as published: ' + JSON.stringify(appState),
      );
    }
    this.state.set(appId, appState);
  }

  isReviewPublished(appId: string, reviewId: string): boolean {
    const appState = this.state.get(appId);
    if (appState) {
      return appState.includes(reviewId);
    }
    return false;
  }

  isFirstRun(): boolean {
    return this.firstRun;
  }
}

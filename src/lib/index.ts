import {Config} from './config';
import {AppStore} from './reviews/app-store';
import {GooglePlay} from './reviews/google-play';
import {State} from './state/state';
import {File} from './state/storage/file';
import {Constants} from './constants';
import {Database} from './state/storage/database';

async function main(config: Config) {
  let storage;
  if (config.common.storage === 'file') {
    storage = new File(config.common);
  } else {
    storage = new Database(config.common);
  }
  const state = new State(
    config.common,
    await storage.isFirstRun(),
    await storage.read(),
  );
  for (const appConf of config.appStoreApps) {
    const appStore = new AppStore(config.common, appConf, state);
    await appStore.startReview();
  }

  for (const appConf of config.googlePlayApps) {
    const googlePlay = new GooglePlay(config.common, appConf, state);
    await googlePlay.startReview();
  }
  await storage.save(state.state);
}

export async function loop(config: Config): Promise<void> {
  const interval = config.common.interval || Constants.DEFAULT_INTERVAL_SECONDS;
  for (;;) {
    try {
      await main(config);
    } catch (error) {
      console.error(error);
    }
    await delay(interval * 1000);
  }
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// TODO: 別のチャット
// TODO: add help

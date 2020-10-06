export interface StateStorage {
    isFirstRun(): Promise<boolean>;
    read(): Promise<Map<string, string[]>>;
    save(state: Map<string, string[]>): Promise<void> ;
}
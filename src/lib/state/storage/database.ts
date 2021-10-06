import { Sequelize, Model, DataTypes } from "sequelize";
import { Common } from "../../config";
import { StateStorage } from "./state-storage";

interface StatusAttributes {
    type: string;
    status: number;
}

class Status extends Model<StatusAttributes> implements StatusAttributes {
    public type!: string;
    public status!: number;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

interface StatesAttributes {
    appId: string;
    reviewId: string;
}

class State extends Model<StatesAttributes> implements StatesAttributes {
    public appId!: string;
    public reviewId!: string;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

export class Database implements StateStorage {

    private sequelize: Sequelize;

    constructor(private common: Common) {
        this.sequelize = new Sequelize(common.storage, {
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false,
                }
            },
        });
        Status.init(
            {
                type: {
                    type: new DataTypes.STRING,
                    primaryKey: true,
                },
                status: {
                    type: new DataTypes.SMALLINT,
                },
            },
            {
                tableName: 'status',
                sequelize: this.sequelize,
            },
        );
        State.init(
            {
                appId: {
                    type: new DataTypes.STRING,
                    primaryKey: true,
                },
                reviewId: {
                    type: new DataTypes.STRING,
                    primaryKey: true,
                },
            },
            {
                tableName: 'states',
                sequelize: this.sequelize,
            },
        );
    }

    async isFirstRun(): Promise<boolean> {
        await this.sequelize.sync();
        const row = await Status.findOne({
            where: {
                type: 'first_run'
            },
        });
        if (row === null) {
            await Status.create({
                type: 'first_run',
                status: 1,
            });
            return true;
        }
        return false;
    }

    async read(): Promise<Map<string, string[]>> {
        const map = new Map<string, string[]>();
        if (await this.isFirstRun()) {
            return map;
        }
        const rows = await State.findAll();
        for (let row of rows) {
            const reviewIds = map.get(row.appId) || [];
            reviewIds.push(row.reviewId);
            map.set(row.appId, reviewIds);
        }
        return map;
    }

    async save(state: Map<string, string[]>): Promise<void> {
        for (let key of state.keys()) {
            const values = state.get(key);
            if (values == null) {
                continue;
            }
            for (let value of values) {
                await State.upsert({
                    appId: key,
                    reviewId: value,
                });
            }
        }
    }
}
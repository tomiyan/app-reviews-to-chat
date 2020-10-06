#!/usr/bin/env node

import commandLineArgs from "command-line-args";
import { loop } from "../lib";
import { Config } from "../lib/config";

const main = () => {
    const optionDefnitions: commandLineArgs.OptionDefinition[] = [
        { name: 'config', alias: 'c', type: String, defaultOption: true }
    ];
    
    const options = commandLineArgs(optionDefnitions);
    const config = new Config(options.config);
    
    loop(config)
        .catch((error) => {
            console.error(error);
        });
}

main();
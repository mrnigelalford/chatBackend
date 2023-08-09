import 'dotenv/config';
import { InstallGlobalCommands } from './utls.js';


// Simple test command
const USER_COMMAND = {
  name: 'messageCommand',
  description: 'basic user command',
  type: 3,
};


const ALL_COMMANDS = [USER_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
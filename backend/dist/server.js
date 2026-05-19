"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const db_1 = require("./config/db");
dotenv_1.default.config();
const port = Number(process.env.PORT || 5000);
async function bootstrap() {
    await (0, db_1.connectDatabase)();
    app_1.default.listen(port, () => {
        console.log(`Annapurna API server running on http://localhost:${port}`);
    });
}
bootstrap().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
});
process.on('SIGINT', async () => {
    await db_1.prisma.$disconnect();
    process.exit(0);
});

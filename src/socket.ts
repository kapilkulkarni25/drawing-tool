import { io } from "socket.io-client";
const URL =
  process.env.NODE_ENV === "production"
    ? "https://drawing-tool-backend-vz6p.onrender.com"
    : "http://localhost:5000";
export const socket = io(URL);

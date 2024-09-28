import { useEffect, useLayoutEffect, useRef } from "react";
import { useSelector, useDispatch } from 'react-redux';

import { MENU_ITEMS } from "@/constants";
import { actionItemClick } from '@/slice/menuSlice';

import { socket } from "@/socket";

type ToolConfig = {
    size: number;
    color: string;
};

type RootState = {
    menu: {
        activeMenuItem: string;
        actionMenuItem: string | null;
    };
    toolbox: {
        [key: string]: ToolConfig;
    };
};

const Board = () => {
    const dispatch = useDispatch();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawHistory = useRef<ImageData[]>([]);
    const historyPointer = useRef(0);
    const shouldDraw = useRef(false);

    const { activeMenuItem, actionMenuItem } = useSelector((state: RootState) => state.menu);
    const { color, size } = useSelector((state: RootState) => state.toolbox[activeMenuItem]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        if (actionMenuItem === MENU_ITEMS.DOWNLOAD) {
            const URL = canvas.toDataURL();
            const anchor = document.createElement('a');
            anchor.href = URL;
            anchor.download = 'sketch.jpg';
            anchor.click();
        } else if (actionMenuItem === MENU_ITEMS.UNDO || actionMenuItem === MENU_ITEMS.REDO) {
            if (historyPointer.current > 0 && actionMenuItem === MENU_ITEMS.UNDO) historyPointer.current -= 1;
            if (historyPointer.current < drawHistory.current.length - 1 && actionMenuItem === MENU_ITEMS.REDO) historyPointer.current += 1;
            const imageData = drawHistory.current[historyPointer.current];
            context.putImageData(imageData, 0, 0);
        }
        dispatch(actionItemClick(null));
    }, [actionMenuItem, dispatch]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const changeConfig = (color: string, size: number) => {
            context.strokeStyle = color;
            context.lineWidth = size;
        };

        const handleChangeConfig = (config: ToolConfig) => {
            changeConfig(config.color, config.size);
        };

        changeConfig(color, size);
        socket.on('changeConfig', handleChangeConfig);

        return () => {
            socket.off('changeConfig', handleChangeConfig);
        };
    }, [color, size]);

    useLayoutEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const beginPath = (x: number, y: number) => {
            context.beginPath();
            context.moveTo(x, y);
        };

        const drawLine = (x: number, y: number) => {
            context.lineTo(x, y);
            context.stroke();
        };

        const handleMouseDown = (e: MouseEvent | TouchEvent) => {
            shouldDraw.current = true;
            const clientX = (e instanceof MouseEvent ? e.clientX : e.touches[0].clientX);
            const clientY = (e instanceof MouseEvent ? e.clientY : e.touches[0].clientY);
            beginPath(clientX, clientY);
            socket.emit('beginPath', { x: clientX, y: clientY });
        };

        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!shouldDraw.current) return;
            const clientX = (e instanceof MouseEvent ? e.clientX : e.touches[0].clientX);
            const clientY = (e instanceof MouseEvent ? e.clientY : e.touches[0].clientY);
            drawLine(clientX, clientY);
            socket.emit('drawLine', { x: clientX, y: clientY });
        };

        const handleMouseUp = () => {
            shouldDraw.current = false;
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            drawHistory.current.push(imageData);
            historyPointer.current = drawHistory.current.length - 1;
        };

        const handleBeginPath = (path: { x: number, y: number }) => {
            beginPath(path.x, path.y);
        };

        const handleDrawLine = (path: { x: number, y: number }) => {
            drawLine(path.x, path.y);
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);

        canvas.addEventListener('touchstart', handleMouseDown);
        canvas.addEventListener('touchmove', handleMouseMove);
        canvas.addEventListener('touchend', handleMouseUp);

        socket.on('beginPath', handleBeginPath);
        socket.on('drawLine', handleDrawLine);

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);

            canvas.removeEventListener('touchstart', handleMouseDown);
            canvas.removeEventListener('touchmove', handleMouseMove);
            canvas.removeEventListener('touchend', handleMouseUp);

            socket.off('beginPath', handleBeginPath);
            socket.off('drawLine', handleDrawLine);
        };
    }, []);

    return <canvas ref={canvasRef}></canvas>;
};

export default Board;

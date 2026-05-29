const express = require('express');
const cors = require('cors'); // <--- 1. Agrega esta línea
const app = express();

app.use(cors()); // <--- 2. Agrega esta línea antes de tus rutas (como app.post('/descargar'))
app.use(express.json());
import express from 'express';
import ffmpegStatic from 'ffmpeg-static';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const ejecutarProceso = (archivo, argumentos) => {
    return new Promise((resolve, reject) => {
        execFile(archivo, argumentos, (error, stdout, stderr) => {
            if (error) {
                reject(error.message || stderr || error);
            } else {
                resolve(stdout);
            }
        });
    });
};

app.post('/descargar', async (req, res) => {
    const { url, formato } = req.body; // Recibe la URL y el formato (flac o mp3)

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL.' });
    }

    const formatoElegido = formato === 'mp3' ? 'mp3' : 'flac';
    const rutaYtdlp = path.join(process.cwd(), 'yt-dlp.exe');
    const rutaFfmpeg = ffmpegStatic;

    if (!fs.existsSync(rutaYtdlp)) {
        return res.status(500).json({ error: "Falta el motor yt-dlp.exe en la raíz." });
    }

    try {
        console.log(`\n📡 Petición de descarga recibida para: ${url} -> Formato: [${formatoElegido.toUpperCase()}]`);

        // 1. Obtener la info del título
        const infoRaw = await ejecutarProceso(rutaYtdlp, ['--dump-json', url]);
        const info = JSON.parse(infoRaw);
        
        const tituloLimpio = info.title.replace(/[^a-zA-Z0-9 ]/g, "_");
        const rutaSalidaBase = path.join(process.cwd(), tituloLimpio);
        const archivoFinal = `${rutaSalidaBase}.${formatoElegido}`;

        console.log(`🎵 Procesando pista: "${info.title}"`);

        // 2. Parámetros base para yt-dlp
        let argumentosYtdlp = [
            url,
            '-x', // Extraer audio siempre
            '--audio-format', formatoElegido, // flac o mp3 dinámico
            '--embed-thumbnail', // Incrustar carátula
            '--embed-metadata', // Incrustar etiquetas
            '--ffmpeg-location', rutaFfmpeg,
            '-o', `${rutaSalidaBase}.%(ext)s`,
            '--no-warnings'
        ];

        // Si elige MP3, le forzamos explícitamente el bitrate de 320k (la calidad máxima)
        if (formatoElegido === 'mp3') {
            argumentosYtdlp.push('--audio-quality', '320K');
        } else {
            argumentosYtdlp.push('--audio-quality', '0'); // Para FLAC (máximo VBR)
        }

        // Ejecutar descarga y conversión
        await ejecutarProceso(rutaYtdlp, argumentosYtdlp);

        console.log(`✅ Conversión a ${formatoElegido.toUpperCase()} completada.`);

        // 3. Transmitir el archivo resultante
        if (fs.existsSync(archivoFinal)) {
            res.download(archivoFinal, `${info.title}.${formatoElegido}`, (err) => {
                if (fs.existsSync(archivoFinal)) {
                    fs.unlinkSync(archivoFinal);
                }
            });
        } else {
            throw new Error(`El motor no logró consolidar el archivo ${formatoElegido.toUpperCase()} final.`);
        }

    } catch (error) {
        const mensajeError = String(error);
        console.error('❌ ERROR EN CONSOLA:', mensajeError);
        res.status(500).json({ error: mensajeError.substring(0, 120) }); 
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Multi-Formato en http://localhost:${PORT}`);
});
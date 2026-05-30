import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'public')));

// Buscamos una alternativa nativa para entornos Linux limitados
const rutaYtdlp = process.platform === 'win32' 
    ? path.join(__dirname, 'yt-dlp.exe') 
    : 'yt-dlp'; // Usamos el comando por defecto del paquete del sistema si existe

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    if (url.includes('?')) {
        url = url.split('?')[0];
    }

    const carpetaDescargas = path.join(__dirname, 'downloads');
    if (!fs.existsSync(carpetaDescargas)) {
        fs.mkdirSync(carpetaDescargas);
    }

    let formatoAudio = formato === 'mp3' ? 'mp3' : 'flac';
    let comandosAdicionales = formatoAudio === 'mp3' 
        ? '--audio-format mp3 --audio-quality 0' 
        : '--audio-format flac';

    const plantillaSalida = path.join(carpetaDescargas, `nexus_audio_%(title)s.%(ext)s`);
    
    // NOTA: Quitamos la bandera conflictiva de python para producción en Render
    const comando = process.platform === 'win32'
        ? `"${rutaYtdlp}" -x ${comandosAdicionales} --embed-thumbnail --output "${plantillaSalida}" "${url}"`
        : `npx yt-dlp-exec "${url}" -x ${comandosAdicionales} --output "${plantillaSalida}"`;

    console.log(`[NEXUS CLOUD] Ejecutando entorno seguro: ${comando}`);

    exec(comando, (error, stdout, stderr) => {
        if (error) {
            console.error(`[NEXUS ERROR]:`, error);
            return res.status(500).json({ error: 'Error interno en el motor de extracción.', detalles: error.message });
        }

        const archivos = fs.readdirSync(carpetaDescargas);
        const archivoProcesado = archivos.find(f => f.endsWith(`.${formatoAudio}`));

        if (!archivoProcesado) {
            return res.status(500).json({ error: 'El motor no logró localizar el archivo consolidado.' });
        }

        const rutaArchivoCompleta = path.join(carpetaDescargas, archivoProcesado);

        res.download(rutaArchivoCompleta, archivoProcesado, (err) => {
            if (err) console.error(`[NEXUS ERROR] Error en envío:`, err);
            try {
                fs.unlinkSync(rutaArchivoCompleta);
            } catch (cleanupError) {
                console.error(`[NEXUS WARNING] No se pudo borrar el temporal:`, cleanupError);
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Multi-Formato Estable activo en puerto ${PORT}`);
});

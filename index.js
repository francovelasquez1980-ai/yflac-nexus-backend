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

// RUTA CRUCIAL: En Windows busca tu ejecutable local. En Linux (Render) usaremos el comando global directo del sistema.
const rutaYtdlp = process.platform === 'win32' 
    ? path.join(__dirname, 'yt-dlp.exe') 
    : 'yt-dlp';

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    // Limpieza radical de enlaces (fuera cadenas de rastreo ?utm_...)
    if (url.includes('?')) {
        url = url.split('?')[0];
    }

    const carpetaDescargas = path.join(__dirname, 'downloads');
    if (!fs.existsSync(carpetaDescargas)) {
        fs.mkdirSync(carpetaDescargas);
    }

    let formatoAudio = 'flac';
    let comandosAdicionales = '--audio-format flac';

    if (formato === 'mp3') {
        formatoAudio = 'mp3';
        comandosAdicionales = '--audio-format mp3 --audio-quality 0';
    }

    const plantillaSalida = path.join(carpetaDescargas, `nexus_audio_%(title)s.%(ext)s`);
    
    // Comando directo de consola con la carátula habilitada
    const comando = `"${rutaYtdlp}" -x ${comandosAdicionales} --embed-thumbnail --output "${plantillaSalida}" "${url}"`;

    console.log(`[NEXUS PLAN A] Ejecutando en consola: ${comando}`);

    exec(comando, (error, stdout, stderr) => {
        if (error) {
            console.error(`[NEXUS ERROR PLAN A]:`, error);
            return res.status(500).json({ error: 'Error interno en el motor de extracción.', detalles: error.message });
        }

        const archivos = fs.readdirSync(carpetaDescargas);
        const archivoProcesado = archivos.find(f => f.endsWith(`.${formatoAudio}`));

        if (!archivoProcesado) {
            return res.status(500).json({ error: 'El motor no logró consolidar el archivo de salida con su carátula.' });
        }

        const rutaArchivoCompleta = path.join(carpetaDescargas, archivoProcesado);

        res.download(rutaArchivoCompleta, archivoProcesado, (err) => {
            if (err) {
                console.error(`[NEXUS ERROR] Error al enviar archivo:`, err);
            }
            try {
                fs.unlinkSync(rutaArchivoCompleta);
            } catch (cleanupError) {
                console.error(`[NEXUS WARNING] No se pudo borrar el temporal:`, cleanupError);
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Multi-Formato [PLAN A] activo en puerto ${PORT}`);
});

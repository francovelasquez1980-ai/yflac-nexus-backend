import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS y lectura de JSON de forma limpia y global
app.use(cors());
app.use(express.json());

// Servir archivos estáticos de la interfaz web si es necesario
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'public')));

// Ruta inteligente para detectar si usa yt-dlp de Windows (.exe) o el nativo de Linux (Render)
const rutaYtdlp = process.platform === 'win32' ? path.join(__dirname, 'yt-dlp.exe') : 'yt-dlp';

// Ruta principal de descarga
app.post('/descargar', async (req, res) => {
    const { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso multimedial.' });
    }

    // Carpeta temporal para procesar el audio
    const carpetaDescargas = path.join(__dirname, 'downloads');
    if (!fs.existsSync(carpetaDescargas)) {
        fs.mkdirSync(carpetaDescargas);
    }

    // Configurar extensión y calidad según la petición de la interfaz
    let formatoAudio = 'flac';
    let comandosAdicionales = '--audio-format flac';

    if (formato === 'mp3') {
        formatoAudio = 'mp3';
        comandosAdicionales = '--audio-format mp3 --audio-quality 0'; // 320kbps máxima calidad VBR
    }

    // Plantilla de nombre de archivo para evitar caracteres extraños en servidores
    const plantillaSalida = path.join(carpetaDescargas, `nexus_audio_%(title)s.%(ext)s`);

    // Comando unificado de yt-dlp para extraer audio e inyectar la carátula si existe
    const comando = `"${rutaYtdlp}" -x ${comandosAdicionales} --embed-thumbnail --output "${plantillaSalida}" "${url}"`;

    console.log(`[NEXUS BACKEND] Ejecutando extracción: ${comando}`);

    exec(comando, (error, stdout, stderr) => {
        if (error) {
            console.error(`[NEXUS ERROR]:`, error);
            return res.status(500).json({ error: 'Error al procesar el audio con yt-dlp.', detalles: error.message });
        }

        // Buscar el archivo procesado dentro de la carpeta temporal
        const archivos = fs.readdirSync(carpetaDescargas);
        const archivoProcesado = archivos.find(f => f.endsWith(`.${formatoAudio}`));

        if (!archivoProcesado) {
            return res.status(500).json({ error: 'El motor no logró consolidar el archivo de salida.' });
        }

        const rutaArchivoCompleta = path.join(carpetaDescargas, archivoProcesado);

        // Enviar el archivo descargado directamente al navegador del usuario
        res.download(rutaArchivoCompleta, archivoProcesado, (err) => {
            if (err) {
                console.error(`[NEXUS ERROR] Error en la transferencia de datos:`, err);
            }
            
            // Limpieza inmediata del servidor para no saturar el espacio en la nube
            try {
                fs.unlinkSync(rutaArchivoCompleta);
            } catch (cleanupError) {
                console.error(`[NEXUS WARNING] No se pudo borrar el archivo temporal:`, cleanupError);
            }
        });
    });
});

// Mensaje de confirmación de encendido del sistema
app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Multi-Formato activo y escuchando en el puerto ${PORT}`);
});
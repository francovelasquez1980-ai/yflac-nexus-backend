import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    // Limpieza básica de la URL
    if (url.includes('?')) {
        // Preservamos el ID de YouTube por si acaso, si no, limpiamos normal
        if (!url.includes('watch?v=') && !url.includes('youtu.be/')) {
            url = url.split('?')[0];
        }
    }

    const formatoAudio = formato === 'mp3' ? 'mp3' : 'flac';
    console.log(`[NEXUS HYBRID] Solicitando extracción para: ${url} en formato ${formatoAudio}`);

    try {
        // Usamos un endpoint de extracción masiva optimizado para apps en la nube
        const apiFetchUrl = `https://api.cobalt.tools/api/json`;
        
        const respuestaCobalt = await fetch(apiFetchUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                filenamePattern: 'nerd',
                audioFormat: formatoAudio,
                isAudioOnly: true
            })
        });

        if (!respuestaCobalt.ok) {
            throw new Error('El nodo extractor externo rechazó la petición.');
        }

        const data = await respuestaCobalt.json();

        // Si la API nos devuelve un estado de error o no nos da un link directo
        if (data.status === 'error' || !data.url) {
            return res.status(400).json({ 
                error: 'La plataforma origen bloqueó la extracción masiva.',
                detalles: data.text || 'Intenta con otro enlace.' 
            });
        }

        console.log(`[NEXUS HYBRID] ¡Extracción exitosa! Redireccionando flujo de datos...`);

        // Le respondemos a tu Netlify enviándole el enlace directo de descarga de alta velocidad
        // Para que la barra de carga de tu interfaz reaccione de inmediato.
        return res.json({ 
            success: true, 
            downloadUrl: data.url, 
            title: `nexus_audio_${Date.now()}.${formatoAudio}` 
        });

    } catch (error) {
        console.error(`[NEXUS HYBRID ERROR]:`, error);
        return res.status(500).json({ 
            error: 'Los servidores de extracción están saturados en este momento.', 
            detalles: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Sistema Nexus Híbrido e Imbatible activo en puerto ${PORT}`);
});

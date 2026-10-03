# Meetings

Chat y videollamada de hasta **5 personas**, 100 % frontend (React + TypeScript + Vite + [PeerJS](https://peerjs.com)/WebRTC).

## Cómo funciona

1. Al abrir la página escribes tu nombre y recibes **tu código de sala** (6 caracteres).
2. Una persona pulsa **"Abrir mi sala"** y se convierte en el **anfitrión**.
3. Las demás (máximo 4) escriben ese código en **"Unirse a una sala"** o abren el enlace `?sala=CODIGO`.
4. En la sala las cámaras ocupan el centro y el chat va en un panel lateral que se oculta o muestra con un botón
   (muestra los mensajes sin leer). Cada quien activa o desactiva su **micrófono** y **cámara** cuando quiera
   (empiezan apagados, el navegador pide permiso la primera vez).

- El chat y la lista de participantes pasan por el anfitrión; el audio/video va directo entre cada par de personas.
- Si el anfitrión cierra la sala o se va, la sala termina para todos.
- No hay servidor propio: solo se usa el servidor público gratuito de PeerJS para que los navegadores se encuentren.
  Los mensajes y el video viajan por WebRTC entre los navegadores.

## Scripts

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas unitarias (Vitest)
npm run build    # build de producción en dist/
```

> Cámara y micrófono requieren `https` o `localhost`. Para probar entre dispositivos de tu red, publica `dist/` en un
> hosting con https (GitHub Pages, Netlify, Vercel…). Para probar en un mismo equipo, abre varias ventanas
> (cada pestaña obtiene su propio código).

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `src/lib/protocol.ts` | Tipos y validación de los mensajes entre pares |
| `src/lib/room.ts` | Lógica pura del anfitrión (límite de 5, participantes, historial) y códigos de sala |
| `src/lib/media.ts` | Construcción del stream local de cámara/micrófono |
| `src/lib/roomClient.ts` | Orquestación PeerJS (conexiones de datos y llamadas) |
| `src/components/` | Pantallas: nombre, lobby, sala (chat + participantes) |

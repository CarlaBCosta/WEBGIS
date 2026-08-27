import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // O middleware de login do admin intercepta /api/admin/* e, por padrão,
    // o Next trunca corpos de requisição em 10 MB nesse caminho — o que
    // quebrava o upload de GeoJSON grandes (HTTP 500). Limite elevado para
    // comportar as camadas brutas exportadas do QGIS.
    proxyClientMaxBodySize: "300mb",
  },
};

export default nextConfig;

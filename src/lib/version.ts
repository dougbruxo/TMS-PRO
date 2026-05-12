/**
 * Controle de Versão do App
 * 
 * Atualize esta constante a cada deploy significativo.
 * Quando o valor mudar, o sistema limpará localStorage e cookies
 * antigos para evitar "cookies zumbi" de versões anteriores.
 */
export const APP_VERSION = '1.0.1';

/**
 * Chave usada no localStorage para armazenar a versão do app
 * que o navegador do usuário conhece.
 */
export const VERSION_KEY = 'app_version';

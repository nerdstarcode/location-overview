// Paletas categóricas compartilhadas pelos gráficos (echarts) do app.

// Paleta categórica alinhada à marca (index.css: brand-action-*/complementary-*).
export const PALETTE = ['#0072bc', '#19a3fc', '#00cb5d', '#ffc400', '#ff7a00', '#e42600', '#753bbd', '#2cd5b6', '#d92373']

// Paleta segura para daltonismo (Okabe-Ito, estendida com preto/branco/amarelo
// para mais contraste categórico) — usada em todos os gráficos quando o
// toggle de daltonismo está ativo (tema claro). Preto/branco levam borda para
// não sumirem contra fundos claros/escuros.
export const COLORBLIND_PALETTE = ['#000000', '#F0E442', '#0072B2', '#E69F00', '#56B4E9', '#009E73', '#D55E00', '#CC79A7', '#FFFFFF']

// Variante da paleta daltônica para o tema escuro: o preto e os tons mais
// escuros do Okabe-Ito (#0072B2, #D55E00, #009E73) ficam com baixo contraste
// contra o fundo escuro — aqui o peso vai para branco/cinza claro, com só
// alguns tons pastel (mesmo matiz do Okabe-Ito, clareados) para diferenciar
// categorias que dependam só de cor.
export const COLORBLIND_PALETTE_DARK = ['#586671', '#E5E5E5', '#F0E442', '#BFBFBF', '#00BE5C', '#FF7A00', '#F2C57C', '#D9D9D9', '#F2B8D4']

// Paleta de alto contraste (data-high-contrast, ver HighContrastToggle): tons bem mais escuros que
// o normal sobre fundo branco puro, cada um com máxima distância de luminosidade entre si — tem
// prioridade sobre a paleta de daltonismo quando os dois estão ativos ao mesmo tempo.
export const HIGH_CONTRAST_PALETTE_LIGHT = ['#000000', '#003B70', '#7A0000', '#1B5E00', '#5C0080', '#8A5300', '#00615C', '#7A1D4D', '#333333']

// Mesma ideia da paleta de alto contraste, só que clareada para o fundo preto puro do tema escuro.
export const HIGH_CONTRAST_PALETTE_DARK = ['#FFFFFF', '#7CC7FF', '#FF6B6B', '#7CFF6B', '#E29CFF', '#FFD84D', '#5CFFF0', '#FF8AD1', '#E5E5E5']

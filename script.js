// Função para formatar número como moeda
function formatarMoeda(valor) {
    // Validar se é número válido
    if (typeof valor !== 'number' || isNaN(valor)) {
        console.warn('formatarMoeda recebeu valor inválido:', valor);
        return 'R$ 0,00';
    }
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Função que busca o IPCA no SGs do BCB e calcula variação acumulada dos últimos 12 meses
async function buscarInflacao() {
    try {
        // pegar últimos 12 valores mensais
        const url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json';
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        
        // Validar resposta HTTP
        if (!res.ok) {
            console.error('Erro na requisição da inflação:', res.status);
            return null;
        }
        
        const data = await res.json();
        
        // Validar que é array e tem dados
        if (!Array.isArray(data) || data.length === 0) {
            console.warn('Dados de inflação vazios ou inválidos');
            return null;
        }
        
        // cada item tem .valor com vírgula
        let acumulado = 1;
        for (const item of data) {
            // Validar estrutura do item
            if (!item.valor || typeof item.valor !== 'string') {
                console.warn('Item inválido na série de inflação:', item);
                continue;
            }
            
            const mensal = parseFloat(item.valor.replace(',', '.')) / 100;
            
            // Validar se conversão foi bem sucedida
            if (isNaN(mensal)) {
                console.warn('Valor mensal inválido:', item.valor);
                continue;
            }
            
            acumulado *= 1 + mensal;
        }
        
        const anual = (acumulado - 1) * 100; // porcentagem anual
        return isNaN(anual) ? null : anual;
    } catch (e) {
        if (e.name === 'AbortError') {
            console.error('Timeout ao buscar inflação');
        } else {
            console.error('Erro ao buscar inflação:', e);
        }
    }
    return null;
}

// Função para calcular juros compostos
async function calcularJuros() {
    const capital = parseFloat(document.getElementById('capital')?.value);
    const taxa = parseFloat(document.getElementById('taxa')?.value);
    const tempo = parseFloat(document.getElementById('tempo')?.value);
    const periodo = parseFloat(document.getElementById('periodo')?.value) || 1;
    const aporteMensal = parseFloat(document.getElementById('aporteMensal')?.value) || 0;

    // Elementos do DOM
    const errorDiv = document.getElementById('error');
    const resultsDiv = document.getElementById('resultBox');
    const inflationDiv = document.getElementById('inflationBox');
    const capitalResultEl = document.getElementById('capitalResult');
    const jurosResultEl = document.getElementById('jurosResult');
    const montanteResultEl = document.getElementById('montanteResult');
    const taxaResultEl = document.getElementById('taxaResult');
    const periodoResultEl = document.getElementById('periodoResult');
    const infResultEl = document.getElementById('infResult');
    const montanteRealEl = document.getElementById('montanteRealResult');

    // Função auxiliar para limpar mensagens de erro
    function limparMensagens() {
        if (errorDiv) errorDiv.classList.remove('show');
        if (inflationDiv) inflationDiv.classList.remove('show');
    }

    // Função auxiliar para mostrar erro
    function mostrarErro(mensagem) {
        if (errorDiv) {
            errorDiv.textContent = mensagem;
            errorDiv.classList.add('show');
        } else {
            alert(mensagem);
        }
        if (resultsDiv) resultsDiv.classList.remove('show');
    }

    // Validações
    limparMensagens();

    // Validar capital
    if (isNaN(capital) || capital <= 0) {
        mostrarErro('❌ Por favor, insira um capital inicial válido!');
        return;
    }

    // Validar taxa
    if (isNaN(taxa) || taxa < 0) {
        mostrarErro('❌ Por favor, insira uma taxa de juros válida!');
        return;
    }

    // Validar tempo
    if (isNaN(tempo) || tempo <= 0) {
        mostrarErro('❌ Por favor, insira um tempo válido! (digite um número de anos válido)');
        return;
    }

    // Validar período
    if (isNaN(periodo) || periodo < 1) {
        mostrarErro('❌ Períodos por ano devem ser 1 ou mais!');
        return;
    }

    // Validar aporte mensal
    if (isNaN(aporteMensal) || aporteMensal < 0) {
        mostrarErro('❌ Por favor, insira um aporte periódico válido!');
        return;
    }

    try {
        // Fórmula de juros compostos com capitalização n vezes por ano e aporte periódico:
        // M = C × (1 + i/n)^(n×t) + PMT × [((1 + i/n)^(n×t) - 1) / (i/n)]
        const taxaDecimal = taxa / 100;
        const taxaPeriodo = taxaDecimal / periodo;
        const expoente = periodo * tempo;
        const fatorComposto = Math.pow(1 + taxaPeriodo, expoente);
        
        // Montante do capital inicial
        const montanteCapital = capital * fatorComposto;
        
        // Montante dos aportes periódicos (série de pagamentos)
        let montanteAportes = 0;
        if (aporteMensal > 0 && taxaPeriodo > 0) {
            montanteAportes = aporteMensal * ((fatorComposto - 1) / taxaPeriodo);
        } else if (aporteMensal > 0) {
            // Se taxa for 0, é justo multiplicar
            montanteAportes = aporteMensal * expoente;
        }
        
        const montante = montanteCapital + montanteAportes;
        const jurosGanhos = montante - capital - (aporteMensal * expoente);

        // Validar resultados
        if (!isFinite(montante) || !isFinite(jurosGanhos)) {
            mostrarErro('❌ Erro no cálculo! Verifique os valores inseridos.');
            return;
        }

        // Atualizar resultados com textContent (seguro)
        if (capitalResultEl) capitalResultEl.textContent = formatarMoeda(capital);
        if (taxaResultEl) {
            let textoTaxa = taxa.toFixed(2);
            if (textoTaxa.endsWith('.00')) {
                textoTaxa = parseInt(textoTaxa, 10).toString();
            }
            taxaResultEl.textContent = textoTaxa + "%";
        }
        if (periodoResultEl) periodoResultEl.textContent = periodo + (periodo === 1 ? " vez/ano" : " vezes/ano");
        if (jurosResultEl) jurosResultEl.textContent = formatarMoeda(jurosGanhos);
        if (montanteResultEl) montanteResultEl.textContent = formatarMoeda(montante);

        // Mostrar resultado
        if (resultsDiv) resultsDiv.classList.add('show');

        // obtém inflação e calcula montante real
        if (inflationDiv) {
            const inf = await buscarInflacao();
            if (inf != null && inf >= 0) {
                const infDecimal = inf / 100;
                const montanteReal = montante / Math.pow(1 + infDecimal, tempo);
                
                if (infResultEl && isFinite(montanteReal)) {
                    let textoInf = inf.toFixed(2);
                    if (textoInf.endsWith('.00')) textoInf = parseInt(textoInf, 10).toString();
                    infResultEl.textContent = textoInf + "%";
                }
                if (montanteRealEl && isFinite(montanteReal)) {
                    montanteRealEl.textContent = formatarMoeda(montanteReal);
                }
                inflationDiv.classList.add('show');
            } else {
                inflationDiv.classList.remove('show');
            }
        }

        console.log({
            capital,
            taxa,
            tempo,
            periodo,
            aporteMensal,
            montante,
            jurosGanhos
        });
    } catch (e) {
        console.error('Erro ao calcular juros:', e);
        mostrarErro('❌ Erro ao realizar o cálculo. Verifique os valores e tente novamente.');
    }
}

// salva parâmetros no localStorage para conveniência (com validação)
document.addEventListener('beforeunload', () => {
    try {
        const capital = document.getElementById('capital')?.value;
        const taxa = document.getElementById('taxa')?.value;
        const tempo = document.getElementById('tempo')?.value;
        const periodo = document.getElementById('periodo')?.value;
        const aporteMensal = document.getElementById('aporteMensal')?.value;
        
        // Validar antes de salvar
        if (capital && !isNaN(parseFloat(capital))) localStorage.setItem('lastCapital', capital);
        if (taxa && !isNaN(parseFloat(taxa))) localStorage.setItem('lastTaxa', taxa);
        if (tempo && !isNaN(parseFloat(tempo))) localStorage.setItem('lastTempo', tempo);
        if (periodo && !isNaN(parseFloat(periodo))) localStorage.setItem('lastPeriodo', periodo);
        if (aporteMensal && !isNaN(parseFloat(aporteMensal))) localStorage.setItem('lastAporteMensal', aporteMensal);
    } catch (e) {
        console.warn('Não foi possível salvar parâmetros no localStorage:', e);
    }
});

function carregarParametros() {
    try {
        const cap = localStorage.getItem('lastCapital');
        const taxa = localStorage.getItem('lastTaxa');
        const tempo = localStorage.getItem('lastTempo');
        const per = localStorage.getItem('lastPeriodo');
        const aporte = localStorage.getItem('lastAporteMensal');
        
        // Validar dados antes de restaurar
        if (cap && !isNaN(parseFloat(cap))) document.getElementById('capital').value = cap;
        if (taxa && !isNaN(parseFloat(taxa))) document.getElementById('taxa').value = taxa;
        if (tempo && !isNaN(parseFloat(tempo))) document.getElementById('tempo').value = tempo;
        if (per && !isNaN(parseFloat(per))) document.getElementById('periodo').value = per;
        if (aporte && !isNaN(parseFloat(aporte))) document.getElementById('aporteMensal').value = aporte;
    } catch (e) {
        console.warn('Erro ao carregar parâmetros do localStorage:', e);
    }
}

// Função para limpar formulário
function limpar() {
    try {
        const capitalInput = document.getElementById('capital');
        const taxaInput = document.getElementById('taxa');
        const tempoInput = document.getElementById('tempo');
        const periodoInput = document.getElementById('periodo');
        const aporteMensalInput = document.getElementById('aporteMensal');
        
        if (capitalInput) capitalInput.value = '';
        if (taxaInput) taxaInput.value = '';
        if (tempoInput) tempoInput.value = '';
        if (periodoInput) periodoInput.value = '12';
        if (aporteMensalInput) aporteMensalInput.value = '0';
        
        const resultsDiv = document.getElementById('results') || document.getElementById('resultBox');
        if (resultsDiv) resultsDiv.classList.remove('show');
        
        const inflationDiv = document.getElementById('inflationBox');
        if (inflationDiv) inflationDiv.classList.remove('show');
        
        const errorDiv = document.getElementById('error');
        if (errorDiv) errorDiv.classList.remove('show');
        
        // Limpar localStorage também
        try {
            localStorage.removeItem('lastCapital');
            localStorage.removeItem('lastTaxa');
            localStorage.removeItem('lastTempo');
            localStorage.removeItem('lastPeriodo');
            localStorage.removeItem('lastAporteMensal');
        } catch (e) {
            console.warn('Não foi possível limpar localStorage:', e);
        }
        
        if (capitalInput) capitalInput.focus();
    } catch (e) {
        console.error('Erro ao limpar formulário:', e);
    }
}
// Armazenar interval ID para possível cleanup
let dataHoraIntervalId = null;

// fetch current time from WorldTimeAPI and display (falls back to local)
async function atualizarDataHora() {
    const el = document.getElementById('dateTime');
    if (!el) return;
    // always show local time immediately
    const now = new Date();
    el.textContent = now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://worldtimeapi.org/api/ip', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) return;
        const json = await response.json();
        
        // Validar que tem datetime
        if (!json.datetime || typeof json.datetime !== 'string') return;
        
        const dt = new Date(json.datetime);
        if (isNaN(dt.getTime())) return; // Data inválida
        
        const fmt = dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
        el.textContent = fmt;
    } catch (e) {
        console.error('Erro ao obter data/hora:', e);
        // keep local time if API fails
    }
}

let isInitialized = false;

function initialize() {
    // Evitar múltiplas inicializações
    if (isInitialized) return;
    isInitialized = true;

    carregarParametros();
    const inputCapital = document.getElementById('capital');
    if (inputCapital) inputCapital.focus();

    // set current year in footer if present (usando textContent é mais seguro)
    const footer = document.querySelector('footer');
    if (footer) {
        // Não usar innerHTML para evitar XSS
        footer.textContent = `© ${new Date().getFullYear()} Calculadora de Juros Compostos`;
    }

    // update date/time immediately and every 60 seconds
    atualizarDataHora();
    
    // Limpar interval anterior se existir
    if (dataHoraIntervalId !== null) {
        clearInterval(dataHoraIntervalId);
    }
    dataHoraIntervalId = setInterval(atualizarDataHora, 60000);

    // calcular ao pressionar Enter
    document.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            calcularJuros();
        }
    });

    // botões da interface
    const btnCalc = document.getElementById('calcularBtn');
    if (btnCalc) btnCalc.addEventListener('click', calcularJuros);

    const btnClear = document.getElementById('limparBtn');
    if (btnClear) btnClear.addEventListener('click', limpar);
}

document.addEventListener('DOMContentLoaded', initialize);
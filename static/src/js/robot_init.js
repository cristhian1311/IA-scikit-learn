/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onMounted, onWillUnmount, useRef, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

class RobotComponent extends Component {
    setup() {
        this.root = useRef("root");
        this.chatInput = useRef("chatInput");
        this.robot = null;
        this.nextMessageId = 1;

        // Servicios de Odoo para consultas
        this.orm = useService("orm");

        this.state = useState({
            messages: [
                {
                    id: 0,
                    type: 'bot',
                    text: '¡Hola! 👋 Soy Roby, tu asistente de ventas con IA. 🤖\n\n¡Mueve tu mouse y verás cómo te sigo! También puedes hacerme click para ver mis reacciones. 😊\n\nPuedo ayudarte con:\n• 📊 Estado de ventas\n• 🛒 Qué comprar según temporada\n• 📈 Análisis de tendencias\n\n¿En qué te puedo ayudar hoy?'
                }
            ]
        });

        // Recomendaciones estacionales (sincronizado con Python)
        this.seasonalRecommendations = {
            1: [ // Enero - Verano
                "Bebidas frías (gaseosas, jugos, agua)",
                "Bloqueador solar y sombreros",
                "Helados y productos congelados",
                "Ropa de playa (trajes de baño, sandalias)"
            ],
            2: [ // Febrero - Carnavales/San Valentín
                "Globos de agua y pinturas faciales",
                "Chocolate, peluches y tarjetas",
                "Flores (rosas especialmente)"
            ],
            3: [ // Marzo - Semana Santa
                "Pescados y mariscos",
                "Ingredientes tradicionales",
                "Útiles escolares"
            ],
            4: [ // Abril - Otoño
                "Ropa de entretiempo",
                "Paraguas e impermeables"
            ],
            5: [ // Mayo - Día de la Madre
                "Regalos para mamá (perfumes, joyas)",
                "Flores, tarjetas y chocolates",
                "Electrodomésticos pequeños"
            ],
            6: [ // Junio - Día del Padre/Invierno
                "Regalos para papá (herramientas, ropa)",
                "Ropa de invierno (chompas, abrigos)",
                "Bebidas calientes (café, chocolate)"
            ],
            7: [ // Julio - Fiestas Patrias
                "Banderas y escarapelas peruanas",
                "Ingredientes anticuchos y chicha",
                "Polos blancos y rojos",
                "Pirotécnicos"
            ],
            8: [ // Agosto - Invierno
                "Ropa térmica y frazadas",
                "Ingredientes sopas y caldos"
            ],
            9: [ // Septiembre - Primavera
                "Flores y plantas ornamentales",
                "Ropa ligera primaveral"
            ],
            10: [ // Octubre - Señor de los Milagros
                "Hábitos morados e imágenes religiosas",
                "Turrón de Doña Pepa",
                "Velas moradas y flores"
            ],
            11: [ // Noviembre - Pre-Navidad
                "Disfraces Halloween",
                "Decoración navideña temprana",
                "Productos Black Friday"
            ],
            12: [ // Diciembre - Navidad
                "Panetón y chocolate navideño",
                "Decoración navideña (árbol, luces)",
                "Juguetes para niños",
                "Ropa elegante y zapatos",
                "Licores, vinos y sidra",
                "Fuegos artificiales"
            ]
        };

        this.monthNames = {
            1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
            5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
            9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
        };

        this.festivities = {
            1: "Año Nuevo • Verano en la costa",
            2: "San Valentín (14) • Carnavales",
            3: "Semana Santa (variable)",
            4: "Otoño",
            5: "Día de la Madre (2do domingo)",
            6: "Día del Padre (3er domingo) • Inti Raymi (24)",
            7: "Fiestas Patrias (28-29) 🇵🇪",
            8: "Santa Rosa de Lima (30)",
            9: "Primavera • Señor de los Milagros",
            10: "Señor de los Milagros • Mes Morado 💜",
            11: "Halloween • Black Friday",
            12: "Navidad (25) 🎄 • Año Nuevo (31) 🎆"
        };

        onMounted(() => {
            if (!this.root.el) {
                console.error("❌ Root element not found!");
                return;
            }

            console.log("🤖 Mounting Robot Head Widget...");

            // Cargar THREE.js
            this.loadThreeJS().then(() => {
                this.initializeRobotHead();
            }).catch((error) => {
                console.error("❌ Error loading THREE.js:", error);
            });
        });

        onWillUnmount(() => {
            if (this.robot && this.robot.destroy) {
                this.robot.destroy();
            }
        });
    }

    getCurrentMonth() {
        return new Date().getMonth() + 1; // 1-12
    }

    async getTodaySales() {
        try {
            // Obtener ventas de POS de hoy
            const result = await this.orm.call(
                'sales.ai.prediction',
                'get_pos_sales_today'
            );
            return result;
        } catch (error) {
            console.error('Error getting today POS sales:', error);
            return { success: false, count: 0, total: 0, sales: [] };
        }
    }

    async getTodayMovements() {
        try {
            console.log('🔍 Obtiendo ventas de POS del mes...');
            const result = await this.orm.call(
                'sales.ai.prediction',
                'get_pos_sales_monthly'
            );
            console.log('📦 Resultado de ventas POS:', result);

            if (!result || !result.success) {
                console.warn('⚠️ Error obteniendo ventas de POS.');
                return { 
                    entries_count: 0, 
                    exits_count: 0, 
                    entries: [], 
                    exits: [], 
                    all_movements: [] 
                };
            }

            return {
                entries_count: result.total_orders,
                exits_count: 0,
                entries: [],
                exits: [],
                all_movements: [],
                pos_data: result
            };
        } catch (error) {
            console.error('❌ Error getting POS movements:', error);
            return { entries_count: 0, exits_count: 0, entries: [], exits: [], all_movements: [] };
        }
    }

    async detectAnomalies() {
        try {
            // Obtener productos con stock bajo
            const lowStockResult = await this.orm.call(
                'sales.ai.prediction',
                'get_low_stock_products',
                { threshold: 10 }
            );

            // Obtener productos sin stock
            const outOfStockResult = await this.orm.call(
                'sales.ai.prediction',
                'get_out_of_stock_products'
            );

            const anomalies = [];

            if (lowStockResult.success && lowStockResult.count > 0) {
                anomalies.push(`⚠️ ${lowStockResult.count} productos con stock bajo`);
            }

            if (outOfStockResult.success && outOfStockResult.count > 0) {
                anomalies.push(`🚨 ${outOfStockResult.count} productos sin stock`);
            }

            return {
                has_anomalies: anomalies.length > 0,
                anomalies: anomalies,
                low_stock_products: lowStockResult.products || [],
                out_of_stock_products: outOfStockResult.products || []
            };
        } catch (error) {
            console.error('Error detecting anomalies:', error);
            return { 
                has_anomalies: false, 
                anomalies: [], 
                low_stock_products: [], 
                out_of_stock_products: [] 
            };
        }
    }

    async getProductStock(productName) {
        try {
            console.log('📤 CALL getProductStock:');
            console.log('   productName:', productName);
            
            const result = await this.orm.call(
                'sales.ai.prediction',
                'get_product_stock',
                [productName]  // ← PARÁMETRO POSICIONAL, no named
            );

            console.log('📥 RESPONSE:', result);

            return {
                found: result.success && result.found > 0,
                products: result.products || [],
                total_found: result.found || 0
            };
        } catch (error) {
            console.error('Error searching product stock:', error);
            return { found: false, products: [], total_found: 0 };
        }
    }

    async getAllProductsList() {
        try {
            const result = await this.orm.call(
                'sales.ai.prediction',
                'get_all_products_list'
            );

            return {
                success: result.success,
                products: result.products || [],
                total: result.total || 0
            };
        } catch (error) {
            console.error('Error getting all products:', error);
            return { success: false, products: [], total: 0 };
        }
    }

    askQuestion(question) {
        // Agregar pregunta del usuario
        this.state.messages.push({
            id: this.nextMessageId++,
            type: 'user',
            text: question
        });

        // Cambiar expresión del robot a "pensando"
        if (this.robot && this.robot.setExpression) {
            this.robot.setExpression('thinking');
        }

        // Simular respuesta después de un delay
        setTimeout(() => {
            const response = this.generateResponse(question);
            this.state.messages.push({
                id: this.nextMessageId++,
                type: 'bot',
                text: response
            });

            // Cambiar expresión según la respuesta
            if (this.robot && this.robot.setExpression) {
                if (response.includes('📈') || response.includes('🚀') || response.includes('🎄') || response.includes('¡Excelente!')) {
                    this.robot.setExpression('happy');
                } else if (response.includes('⚠️') || response.includes('📉')) {
                    this.robot.setExpression('sad');
                } else {
                    this.robot.setExpression('normal');
                }
            }

            // Scroll to bottom
            setTimeout(() => {
                const chatMessages = document.querySelector('.chat-messages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }, 100);
        }, 800);
    }

    generateResponse(question) {
        const record = this.props.record;
        const data = record && record.data ? record.data : {};
        const lowerQuestion = question.toLowerCase();

        // ========== SALUDOS Y BIENVENIDA ==========
        if (lowerQuestion.match(/^(hola|buenos|buenas|hey|qué tal|ey|oi)/)) {
            const greetings = [
                "¡Hola! 👋 Soy Roby, tu asistente de ventas. ¿Qué necesitas saber?",
                "¡Hola! 😊 ¿Cómo te puedo ayudar hoy?",
                "¡Hey! 🤖 ¡Qué bueno verte! Pregúntame lo que necesites."
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }

        // ========== AYUDA ==========
        if (lowerQuestion.match(/^(ayuda|help|qué puedes|qué haces|cuéntame|quién eres)/)) {
            return `👋 Soy Roby, tu asistente de ventas inteligente. Puedo ayudarte con:\n\n📊 Ventas:\n• "¿Cómo están las ventas?"\n• "¿Cuánto vendí hoy?"\n• "¿Cuál es mi mejor producto?"\n\n📦 Inventario:\n• "¿Stock de [producto]?"\n• "¿Qué productos tienen bajo stock?"\n• "¿Qué está agotado?"\n\n🛒 Compras:\n• "¿Qué debo comprar?"\n• "Recomendaciones para [mes]"\n\n📈 Análisis:\n• "¿Cuál es la tendencia?"\n• "¿Cuáles son mis mejores productos?"\n• "Comparativa con el mes anterior"\n\n¿Sobre cuál de estos temas quieres hablar? 😊`;
        }

        // ========== AGRADECIMIENTOS ==========
        if (lowerQuestion.match(/gracias|thanks|muchas gracias|ok gracias/)) {
            const thanks = [
                "¡De nada! 😊 Estoy aquí para ayudarte siempre.",
                "¡Un placer! 🤖 Si necesitas algo más, aquí estoy.",
                "¡Para eso estoy! 💙 ¿Algo más?"
            ];
            return thanks[Math.floor(Math.random() * thanks.length)];
        }

        // ========== PREGUNTAS SOBRE MEJOR VENDEDOR/PRODUCTO ==========
        if (lowerQuestion.match(/mejor (producto|vendido|más vendido|ventas|cliente|categoría)|más vend|top products|qué se vende|cuál es mi mejor/)) {
            return `📈 Tus mejores productos últimamente:\n\n1. 🥇 Escritorio personalizable - Stock: 150 uni. - $$$$ 💰\n2. 🥈 Armario con puertas - Stock: 32 uni. - $$$\n3. 🥉 Caja de administración de cables - Stock: 90 uni. - $$\n\nEstos productos tienen:\n✅ Alto movimiento de ventas\n✅ Buena rentabilidad\n✅ Buena disponibilidad\n\n¿Quieres que aumente stock de estos? 📦`;
        }

        // ========== PREGUNTAS SOBRE BAJO STOCK ==========
        if (lowerQuestion.match(/bajo stock|bajo inventario|qué (está|tiene) bajo|poco stock|stock bajo|se está acabando|qué falta/)) {
            this.detectAnomalies().then(data => {
                let response = `⚠️ Productos con BAJO STOCK:\n\n`;
                
                if (data.low_stock_products.length > 0) {
                    data.low_stock_products.slice(0, 5).forEach((p, i) => {
                        const percent = Math.round((p.qty_available / (p.qty_available + 20)) * 100);
                        response += `${i + 1}. ${p.name}\n   📉 Stock: ${p.qty_available} ${p.uom} (${percent}% del recomendado)\n`;
                    });
                    response += `\n💡 Te recomiendo reabastecer estos productos pronto para no perder ventas.`;
                } else {
                    response += `✅ ¡Excelente! Todos tus productos tienen stock adecuado.`;
                }

                this.state.messages.push({
                    id: this.nextMessageId++,
                    type: 'bot',
                    text: response
                });
            });
            return '⏳ Analizando inventario...';
        }

        // ========== PREGUNTAS SOBRE AGOTADOS ==========
        if (lowerQuestion.match(/agotado|sin stock|fuera de stock|no hay|se acabó|no queda/)) {
            this.detectAnomalies().then(data => {
                let response = `🚨 Productos SIN STOCK:\n\n`;
                
                if (data.out_of_stock_products.length > 0) {
                    data.out_of_stock_products.slice(0, 5).forEach((p, i) => {
                        response += `${i + 1}. ${p.name}\n`;
                    });
                    response += `\n⚡ ACCIÓN URGENTE: Estos productos necesitan ser reabastecidos YA para retomar ventas.`;
                } else {
                    response += `✅ ¡Buena noticia! No hay productos sin stock.`;
                }

                this.state.messages.push({
                    id: this.nextMessageId++,
                    type: 'bot',
                    text: response
                });
            });
            return '⏳ Verificando stock...';
        }

        // ========== VENTAS DE HOY ==========
        if (lowerQuestion.match(/ventas.*hoy|hoy.*ventas|cómo va hoy|cuánto vendí hoy|ventas del día|día de hoy/)) {
            this.getTodaySales().then(data => {
                let response = `VENTAS DE HOY\n\n`;
                
                if (data.success && data.count >= 0) {
                    response += `Órdenes: ${data.count}\n`;
                    response += `Total: S/. ${data.total.toFixed(2)}\n`;
                    response += `Promedio/orden: S/. ${data.average.toFixed(2)}\n\n`;

                    if (data.count > 0) {
                        if (data.count >= 10) response += `🚀 ¡Excelente! Día muy productivo\n\n`;
                        else if (data.count >= 5) response += `✅ Buen movimiento hoy\n\n`;
                        else response += `📌 Día normal\n\n`;
                        
                        if (data.orders && data.orders.length > 0) {
                            response += `Últimas 3 ventas:\n`;
                            data.orders.slice(0, 3).forEach((o, i) => {
                                const [date, time] = o.date ? o.date.split(' ') : ['', ''];
                                response += `${i + 1}. ${o.name} - S/. ${o.amount.toFixed(2)} (${o.items_count} items) ${time || ''}\n`;
                            });
                        }
                    } else {
                        response += `💤 Aún sin ventas hoy. ¡Ánimo, el día recién comienza! 💪`;
                    }
                } else {
                    response += `Parece que hoy aún no hay datos de ventas registrados.`;
                }

                this.state.messages.push({
                    id: this.nextMessageId++,
                    type: 'bot',
                    text: response
                });
            });
            return '⏳ Consultando ventas...';
        }

        // ========== COMPARATIVA PERIODOS ==========
        if (lowerQuestion.match(/comparar|vs|versus|diferencia|semana|mes pasado|anterior|cambio|creció|bajó/)) {
            return `📊 Comparativa Períodos\n\n📈 Este mes vs mes anterior:\n• Crecimiento: +15.3%\n• Diferencia: +S/. 2,450.50\n• Tendencia: 🔝 Al alza\n\n🎯 Análisis:\n✅ Buena recuperación después de la semana anterior\n✅ Productos de oficina liderando ventas\n⚠️ Categoría de electrodomésticos bajó 8%\n\n💡 Recomendación: Promociona más los productos de oficina aprovechando el momentum.`;
        }

        // ========== PREGUNTAS SOBRE TENDENCIAS ==========
        if (lowerQuestion.match(/tendencia|cómo.*ventas|están.*ventas|crecimiento|comportamiento/)) {
            const trend = data.trend || 'estable';
            const growthRate = data.growth_rate || 0;

            if (trend === 'creciente') {
                return `¡EXCELENTE NOTICIA!\n\nTus ventas están en TENDENCIA CRECIENTE (${growthRate.toFixed(1)}% ↑)\n\n✅ Esto significa:\n• Tus estrategias funcionan\n• Los clientes están comprando más\n• Tu inventario se está moviendo\n\n🎯 Mi recomendación:\n1. Mantén tu estrategia actual\n2. Aumenta stock de productos top\n3. Capitaliza el momentum con promociones\n\n¡Lo estás haciendo genial! 🚀`;
            } else if (trend === 'decreciente') {
                return `Veo que tus ventas están bajando (${Math.abs(growthRate).toFixed(1)}% ↓)\n\n⚠️ Pero no te preocupes, aquí van mis recomendaciones:\n\n1. 🎯 Analiza qué cambió\n   - ¿Subieron precios?\n   - ¿Temporada baja?\n   - ¿Competencia nueva?\n\n2. 💡 Toma acción:\n   - Revisa tus precios vs mercado\n   - Lanza promociones estratégicas\n   - Publica en redes sociales\n\n3. 📊 Enfócate en productos estrella\n   - Descuenta productos lentos\n   - Promociona productos top\n\n¿Quieres que te recomiende qué hacer? 💪`;
            } else {
                return `Tus ventas están ESTABLES\n\nNo hay cambios significativos en el último período.\n\n💡 Esto es buen momento para:\n✅ Innovar: Prueba nuevos productos\n✅ Marketing: Amplía tu alcance\n✅ Experiencia: Mejora servicio al cliente\n✅ Temporada: Prepárate para próximas fechas especiales\n\n¿Quieres que te ayude a planificar algo específico? 🎯`;
            }
        }

        // ========== STOCK DE PRODUCTO ESPECÍFICO ==========
        if (lowerQuestion.includes('stock') || lowerQuestion.includes('disponible') || 
            (lowerQuestion.includes('cuánto') && lowerQuestion.includes('hay'))) {
            
            // Extraer nombre del producto
            let productName = '';
            
            // Estrategia 1: Buscar después de "de" o "del"
            const afterPrep = lowerQuestion.match(/(?:de|del)\s+(.+)/);
            if (afterPrep && afterPrep[1]) {
                productName = afterPrep[1]
                    .replace(/\?/g, '')
                    .replace(/stock/g, '')
                    .replace(/disponible/g, '')
                    .trim();
            }
            
            // Estrategia 2: Si no hay, extraer palabras después de "stock"
            if (!productName) {
                const afterStock = lowerQuestion.match(/stock\s+(?:de\s+)?(.+)/);
                if (afterStock && afterStock[1]) {
                    productName = afterStock[1]
                        .replace(/\?/g, '')
                        .trim();
                }
            }
            
            // Si no encontró producto, pedir aclaración
            if (!productName || productName.length < 2) {
                return `❓ Claro, ¿de qué producto quieres saber el stock? Puedes preguntarme:\n"¿Stock de cajón?"\n"¿Cuánto hay de escritorio?"\n"¿Disponible de pizarra?"`;
            }

            // Buscar el stock del producto
            this.getProductStock(productName).then(data => {
                let response = `🔎 Stock de: ${productName}\n\n`;

                if (data.found && data.products && data.products.length > 0) {
                    data.products.forEach((product, i) => {
                        response += `${i + 1}. ${product.name}\n`;
                        response += `   📦 Disponible: ${product.qty_available} ${product.uom}\n`;
                        response += `   🔒 Reservado: ${product.qty_reserved} ${product.uom}\n`;
                        response += `   💰 Precio: S/. ${(product.price || 0).toFixed(2)}\n`;
                        
                        if (product.warning === 'LOW') {
                            response += `   ⚠️ STOCK BAJO\n`;
                        } else if (product.warning === 'OUT') {
                            response += `   🚨 SIN STOCK\n`;
                        } else {
                            response += `   ✅ OK\n`;
                        }
                        response += `\n`;
                    });
                } else {
                    response = `😟 No encontré productos con ese nombre.\n\n`;
                    response += `📋 Aquí están los primeros productos disponibles:\n\n`;
                    
                    // Mostrar lista de productos
                    this.getAllProductsList().then(allData => {
                        if (allData.success && allData.products && allData.products.length > 0) {
                            allData.products.slice(0, 10).forEach((p, i) => {
                                response += `${i + 1}. ${p.name}`;
                                if (p.sku) response += ` (${p.sku})`;
                                response += ` - Stock: ${p.qty_available}\n`;
                            });
                            response += `\n💡 ¿Alguno de estos es el que buscas?`;
                        }
                        
                        this.state.messages.push({
                            id: this.nextMessageId++,
                            type: 'bot',
                            text: response
                        });
                    });
                    return; // No agregar respuesta vacía
                }

                this.state.messages.push({
                    id: this.nextMessageId++,
                    type: 'bot',
                    text: response
                });
            });
            
            return `⏳ Buscando stock de "${productName}"...`;
        }

        // ========== PREGUNTAS SOBRE QUÉ COMPRAR ==========
        if (lowerQuestion.match(/comprar|qué (compro|debo comprar|sugiero|recomiendas|hay que comprar)|inventario|productos/)) {
            const currentMonth = this.getCurrentMonth();
            const monthName = this.monthNames[currentMonth];
            const recommendations = this.seasonalRecommendations[currentMonth] || [];

            let response = `🛒 RECOMENDACIONES PARA ${monthName.toUpperCase()}\n\n`;
            response += `📅 Temporada: ${this.festivities[currentMonth]}\n\n`;
            response += `📌 Productos recomendados:\n`;
            
            recommendations.slice(0, 5).forEach((rec, i) => {
                response += `${i + 1}. ${rec}\n`;
            });

            response += `\n💡 Análisis de tu stock actual:\n`;
            response += `✅ Productos que tienes: Perfecto\n`;
            response += `⚠️ Fórmula recomendada:\n   • 40% productos temporada\n   • 40% best-sellers\n   • 20% experimentales\n\n¿Quieres que te haga un presupuesto de compra? 📊`;
            
            return response;
        }

        // ========== PREGUNTAS SOBRE CLIENTES ==========
        if (lowerQuestion.match(/cliente|comprador|quién compra|perfil|demográfico/)) {
            return `👥 PERFIL DE TUS CLIENTES\n\n🏢 Principales segmentos:\n1. Empresas (60%) - Oficinas, negocios\n2. Particulares (30%) - Hogar, decoración\n3. Revendedores (10%) - Minoristas\n\n📊 Datos interesantes:\n• Compra promedio: S/. 450\n• Frecuencia: 2-3 veces/mes\n• Producto preferido: Muebles de oficina\n• Mejor hora: 10 AM - 2 PM\n\n🎯 Oportunidad: Enfócate en empresas, es tu mayor volumen. ¿Quieres estrategias para retenerlas?`;
        }

        // ========== CUMPLEAÑOS, FESTIVALES, EVENTOS ==========
        if (lowerQuestion.match(/próximo|fecha especial|navidad|año nuevo|día|mes|black|cyber|promo/)) {
            return `🎉 PRÓXIMOS EVENTOS IMPORTANTES\n\n📅 Este mes: ${this.festivities[this.getCurrentMonth()]}\n\n🎁 Eventos próximos:\n• 14 días: San Valentín (ropa, accesorios)\n• 21 días: Oferta especial sugerida\n• 35 días: Black Friday prepararse\n• 45 días: Navidad (planificación)\n\n💡 Estrategia recomendada:\n✅ Comienza a stockear ahora\n✅ Prepara promociones\n✅ Avisa a clientes frecuentes\n\n¿Quieres que planifiquemos el stock para estos eventos? 📦`;
        }

        // ========== RESPUESTA POR DEFECTO MEJORADA ==========
        return `🤔 Interesante pregunta...\n\nNo entendí bien, pero puedo ayudarte con:\n\n📊 Ventas & Análisis\n💰 "¿Cómo van las ventas?"\n📈 "Muéstrame la tendencia"\n🥇 "¿Cuál es mi mejor producto?"\n\n📦 Inventario\n🛒 "¿Stock de [producto]?"\n⚠️ "¿Qué tiene bajo stock?"\n🚨 "¿Qué está agotado?"\n\n🎯 Compras\n📋 "¿Qué debo comprar?"\n🎁 "Recomendaciones para [mes]"\n\nO simplemente di "AYUDA" para ver todos mis comandos 😊`;
    }

    sendMessage() {
        const input = this.chatInput.el;
        const message = input.value.trim();

        if (message) {
            this.askQuestion(message);
            input.value = '';
        }
    }

    onKeyDown(ev) {
        if (ev.key === 'Enter') {
            this.sendMessage();
        }
    }

    async loadThreeJS() {
        if (typeof window.THREE !== 'undefined') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load THREE.js"));
            document.head.appendChild(script);
        });
    }

    initializeRobotHead() {
        const THREE = window.THREE;
        if (!THREE) return;

        const uniqueId = `robot-head-${Math.random().toString(36).substr(2, 9)}`;
        this.root.el.id = uniqueId;

        setTimeout(() => {
            try {
                this.robot = this.createRobotHead(uniqueId, THREE);
                console.log("✅ Robot head initialized!");
            } catch (error) {
                console.error("❌ Error:", error);
            }
        }, 100);
    }

    createRobotHead(containerId, THREE) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Container ${containerId} not found`);

        // Scene
        const scene = new THREE.Scene();

        // Camera
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(200, 200);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(2, 3, 4);
        scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0x667eea, 0.6, 20);
        pointLight.position.set(-3, 2, 3);
        scene.add(pointLight);

        // Robot Head Group
        const head = new THREE.Group();

        // Materials
        const headMaterial = new THREE.MeshPhongMaterial({
            color: 0x5ca0f2,
            shininess: 120,
            specular: 0xaaaaaa
        });
        const eyeMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff88,
            emissive: 0x00ff44,
            emissiveIntensity: 0.8
        });
        const antennaMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const antennaLightMaterial = new THREE.MeshPhongMaterial({
            color: 0xff3366,
            emissive: 0xff0044,
            emissiveIntensity: 0.7
        });

        // Head
        const headGeometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        const headMesh = new THREE.Mesh(headGeometry, headMaterial);
        head.add(headMesh);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.4, 0.2, 0.91);
        head.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.4, 0.2, 0.91);
        head.add(rightEye);

        // Pupils
        const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const pupilGeometry = new THREE.SphereGeometry(0.08, 12, 12);

        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(-0.4, 0.2, 1.0);
        head.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(0.4, 0.2, 1.0);
        head.add(rightPupil);

        // Antenna
        const antenna = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8),
            antennaMaterial
        );
        antenna.position.y = 1.3;
        head.add(antenna);

        const antennaBall = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 16, 16),
            antennaLightMaterial
        );
        antennaBall.position.y = 1.7;
        head.add(antennaBall);

        // Mouth
        const mouthGeometry = new THREE.BoxGeometry(0.8, 0.08, 0.1);
        const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.4, 0.91);
        head.add(mouth);

        scene.add(head);

        // Mouse tracking variables
        let mouseX = 0;
        let mouseY = 0;
        let targetRotationY = 0;
        let targetRotationX = 0;

        // Mouse move handler
        const onMouseMove = (event) => {
            const rect = container.getBoundingClientRect();
            mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Calculate target rotations for head
            targetRotationY = mouseX * 0.5;
            targetRotationX = mouseY * 0.3;
        };

        // Click handler for reactions
        let isReacting = false;
        const onClick = () => {
            if (isReacting) return;
            isReacting = true;

            // Random reactions
            const reactions = ['wave', 'spin', 'jump', 'nod'];
            const reaction = reactions[Math.floor(Math.random() * reactions.length)];

            if (reaction === 'wave') {
                // Wave animation
                let waveTime = 0;
                const waveInterval = setInterval(() => {
                    waveTime += 0.1;
                    head.rotation.z = Math.sin(waveTime * 10) * 0.3;
                    if (waveTime > 1) {
                        clearInterval(waveInterval);
                        head.rotation.z = 0;
                        isReacting = false;
                    }
                }, 50);
            } else if (reaction === 'spin') {
                // Spin animation
                let spinTime = 0;
                const spinInterval = setInterval(() => {
                    spinTime += 0.1;
                    head.rotation.y += 0.3;
                    if (spinTime > 2) {
                        clearInterval(spinInterval);
                        isReacting = false;
                    }
                }, 50);
            } else if (reaction === 'jump') {
                // Jump animation
                let jumpTime = 0;
                const originalY = head.position.y;
                const jumpInterval = setInterval(() => {
                    jumpTime += 0.1;
                    head.position.y = originalY + Math.abs(Math.sin(jumpTime * 5)) * 0.5;
                    if (jumpTime > 1) {
                        clearInterval(jumpInterval);
                        head.position.y = originalY;
                        isReacting = false;
                    }
                }, 50);
            } else if (reaction === 'nod') {
                // Nod animation
                let nodTime = 0;
                const nodInterval = setInterval(() => {
                    nodTime += 0.1;
                    head.rotation.x = Math.sin(nodTime * 10) * 0.3;
                    if (nodTime > 1) {
                        clearInterval(nodInterval);
                        head.rotation.x = 0;
                        isReacting = false;
                    }
                }, 50);
            }

            // Happy expression during reaction
            if (this.setExpression) {
                this.setExpression('happy');
            }
        };

        // Add event listeners
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('click', onClick);

        // Animation
        let time = 0;
        let animationId;
        let expression = 'normal';

        const animate = () => {
            animationId = requestAnimationFrame(animate);
            time += 0.01;

            // Smooth head rotation following mouse
            if (!isReacting) {
                head.rotation.y += (targetRotationY - head.rotation.y) * 0.1;
                head.rotation.x += (targetRotationX - head.rotation.x) * 0.1;
            }

            // Head bobbing (subtle when following mouse)
            const bobbingIntensity = isReacting ? 0 : 0.05;
            head.position.y += (Math.sin(time * 1.5) * bobbingIntensity - head.position.y) * 0.1;

            // Antenna bounce
            antennaBall.position.y = 1.7 + Math.sin(time * 3) * 0.08;

            // Eye blinking
            const blinkScale = Math.abs(Math.sin(time * 2)) > 0.96 ? 0.1 : 1;
            leftEye.scale.y = blinkScale;
            rightEye.scale.y = blinkScale;

            // Pupils follow mouse
            const pupilOffsetX = mouseX * 0.1;
            const pupilOffsetY = mouseY * 0.08;

            leftPupil.position.x = -0.4 + pupilOffsetX;
            leftPupil.position.y = 0.2 + pupilOffsetY;
            rightPupil.position.x = 0.4 + pupilOffsetX;
            rightPupil.position.y = 0.2 + pupilOffsetY;

            // Expressions
            if (expression === 'happy') {
                mouth.rotation.z = Math.PI;
                mouth.scale.x = 1.2;
                leftEye.scale.x = 1.1;
                rightEye.scale.x = 1.1;
            } else if (expression === 'sad') {
                mouth.rotation.z = 0;
                mouth.scale.x = 1.0;
                leftEye.scale.x = 0.9;
                rightEye.scale.x = 0.9;
            } else if (expression === 'thinking') {
                mouth.scale.x = 0.6;
            } else {
                mouth.rotation.z = 0;
                mouth.scale.x = 1.0;
                leftEye.scale.x = 1.0;
                rightEye.scale.x = 1.0;
            }

            renderer.render(scene, camera);
        };

        animate();

        return {
            destroy: () => {
                if (animationId) cancelAnimationFrame(animationId);
                container.removeEventListener('mousemove', onMouseMove);
                container.removeEventListener('click', onClick);
                if (renderer) {
                    renderer.dispose();
                    if (container && renderer.domElement) {
                        container.removeChild(renderer.domElement);
                    }
                }
            },
            setExpression: (expr) => {
                expression = expr;
                setTimeout(() => { expression = 'normal'; }, 2000);
            }
        };
    }
}

RobotComponent.template = "sales.RobotComponent";

registry.category("fields").add("robot_assistant", RobotComponent);
console.log("✅ Robot Head with Interactive Features registered");

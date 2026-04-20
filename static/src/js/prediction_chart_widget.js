odoo.define('sales.prediction_chart_widget', function(require) {
    'use strict';

    var Widget = require('web.Widget');
    var core = require('web.core');
    var QWeb = core.qweb;

    var PredictionChartWidget = Widget.extend({
        className: 'o_prediction_chart_widget',
        template: 'sales.prediction_chart_template',

        init: function(parent, state) {
            this._super(parent);
            this.state = state;
            this.chart_instance = null;
        },

        start: function() {
            var self = this;
            this._load_chartjs().then(function() {
                self._render_chart();
                self._bind_events();
            });
            return this._super();
        },

        _load_chartjs: function() {
            return new Promise(function(resolve) {
                if (window.Chart) {
                    resolve();
                    return;
                }
                
                var script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
                script.onload = resolve;
                script.onerror = function() {
                    console.error('Error cargando Chart.js');
                    resolve();
                };
                document.head.appendChild(script);
            });
        },

        _render_chart: function() {
            var self = this;
            var canvas = this.$('canvas#prediction_chart')[0];
            
            if (!canvas || !window.Chart) {
                setTimeout(function() { self._render_chart(); }, 500);
                return;
            }

            if (this.chart_instance) {
                this.chart_instance.destroy();
            }

            var data = this._get_chart_data();
            var ctx = canvas.getContext('2d');

            this.chart_instance = new window.Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.dates,
                    datasets: [
                        {
                            label: 'Ventas Predichas',
                            data: data.amounts,
                            borderColor: '#1f77b4',
                            backgroundColor: 'rgba(31, 119, 180, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#1f77b4',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            pointHoverRadius: 8
                        },
                        {
                            label: 'Promedio',
                            data: Array(data.amounts.length).fill(data.average),
                            borderColor: '#ff7f0e',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: {
                        duration: 750
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 13, weight: 'bold' },
                                color: '#333',
                                padding: 15,
                                usePointStyle: true
                            }
                        },
                        title: {
                            display: true,
                            text: 'Predicción de Ventas - ' + data.period_name,
                            font: { size: 16, weight: 'bold' },
                            padding: 20,
                            color: '#333'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Monto',
                                font: { weight: 'bold' }
                            },
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toFixed(0);
                                }
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Fecha',
                                font: { weight: 'bold' }
                            }
                        }
                    }
                }
            });
        },

        _get_chart_data: function() {
            var parent = this.getParent();
            if (!parent || !parent.state || !parent.state.data) {
                return { dates: ['Sin datos'], amounts: [0], average: 0, period_name: 'N/A' };
            }

            var data = parent.state.data;
            var date_from = data.date_from;
            var date_to = data.date_to;
            var lines_data = data.prediction_line_ids || [];
            
            // Determinar si aplicar filtro
            var shouldFilter = date_from && date_to && date_from !== date_to;
            
            var dates = [];
            var amounts = [];
            var total = 0;

            // Procesar líneas de predicción
            if (lines_data && lines_data.data) {
                for (var i = 0; i < lines_data.data.length; i++) {
                    var line = lines_data.data[i];
                    if (line[2]) {
                        var line_date = line[2].date;
                        
                        // Aplicar filtro solo si hay fechas válidas
                        var includeLine = true;
                        if (shouldFilter) {
                            includeLine = (line_date >= date_from && line_date <= date_to);
                        }
                        
                        if (includeLine) {
                            dates.push(line_date);
                            var amount = parseFloat(line[2].predicted_amount) || 0;
                            amounts.push(amount);
                            total += amount;
                        }
                    }
                }
            }

            var avg = amounts.length > 0 ? total / amounts.length : 0;
            var period_name = shouldFilter ? this._formatDateRange(date_from, date_to) : 'Todas las Predicciones';

            return {
                dates: dates.length > 0 ? dates : ['Sin datos'],
                amounts: amounts.length > 0 ? amounts : [0],
                average: avg,
                period_name: period_name
            };
        },

        _formatDateRange: function(date_from, date_to) {
            // Convertir formato de fecha YYYY-MM-DD a formato legible
            var from_parts = date_from.split('-');
            var to_parts = date_to.split('-');
            
            var months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            var from_month = months[parseInt(from_parts[1]) - 1];
            var to_month = months[parseInt(to_parts[1]) - 1];
            var from_year = from_parts[0];
            var to_year = to_parts[0];
            
            if (from_year === to_year) {
                if (from_parts[1] === to_parts[1]) {
                    // Mismo mes y año
                    return from_parts[2] + ' - ' + to_parts[2] + ' ' + from_month + ' ' + from_year;
                } else {
                    // Diferente mes, mismo año
                    return from_parts[2] + ' ' + from_month + ' - ' + to_parts[2] + ' ' + to_month + ' ' + from_year;
                }
            } else {
                // Diferente año
                return from_parts[2] + ' ' + from_month + ' ' + from_year + ' - ' + to_parts[2] + ' ' + to_month + ' ' + to_year;
            }
        },

        _bind_events: function() {
            var self = this;
            
            // Buscar los campos de fecha y escuchar cambios
            var date_from_input = this.$('input[name="date_from"]')[0];
            var date_to_input = this.$('input[name="date_to"]')[0];
            
            if (date_from_input) {
                date_from_input.addEventListener('change', function() {
                    setTimeout(function() {
                        self._render_chart();
                        self._update_table_display();
                    }, 100);
                });
            }
            
            if (date_to_input) {
                date_to_input.addEventListener('change', function() {
                    setTimeout(function() {
                        self._render_chart();
                        self._update_table_display();
                    }, 100);
                });
            }

            // También escuchar cambios generales del formulario
            var form_view = this.getParent();
            if (form_view && form_view.on_field_changed) {
                form_view.on_field_changed.add(function() {
                    setTimeout(function() {
                        self._render_chart();
                    }, 200);
                });
            }

            // Inicializar estado de tabla
            setTimeout(function() {
                self._update_table_display();
            }, 300);
        },

        _update_table_display: function() {
            var parent = this.getParent();
            if (!parent || !parent.state || !parent.state.data) {
                return;
            }

            var data = parent.state.data;
            var date_from = data.date_from;
            var date_to = data.date_to;
            
            // Si no hay fechas válidas, mostrar todas las filas
            var shouldFilter = date_from && date_to && date_from !== date_to;

            // Buscar todas las filas de la tabla
            var rows = document.querySelectorAll('[data-model="sale.prediction.line"] tbody tr');
            rows.forEach(function(row, index) {
                if (!shouldFilter) {
                    // Mostrar todas las filas si no hay filtro
                    row.style.display = '';
                } else {
                    // Aplicar filtro por fechas
                    var cells = row.querySelectorAll('td');
                    if (cells && cells.length > 0) {
                        var cell_text = cells[0].textContent.trim();
                        
                        // Verificar si la fecha está dentro del rango
                        if (cell_text >= date_from && cell_text <= date_to) {
                            row.style.display = '';
                        } else {
                            row.style.display = 'none';
                        }
                    }
                }
            });
        }
    });

    // Registrar el widget
    require('web.field_registry').add('prediction_chart_widget', PredictionChartWidget);

    return PredictionChartWidget;
});

from odoo import models, fields, api
from odoo.exceptions import UserError
from datetime import datetime, timedelta
import logging
import json
import unicodedata

try:
    from sklearn.linear_model import LinearRegression
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    import numpy as np
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

_logger = logging.getLogger(__name__)


class SalesAIPrediction(models.Model):
    """Modelo para almacenar predicciones y análisis de IA"""
    _name = 'sales.ai.prediction'
    _description = 'Predicciones de IA para Ventas'

    name = fields.Char(string='Referencia', required=True, default='New')
    date = fields.Date(string='Fecha', default=fields.Date.context_today, required=True)
    product_id = fields.Many2one('product.product', string='Producto', required=True)
    quantity = fields.Float(string='Cantidad', required=True, default=1.0)
    unit_price = fields.Float(string='Precio Unitario', compute='_compute_unit_price', store=True)
    total_price = fields.Float(string='Precio Total', compute='_compute_total_price', store=True)
    notes = fields.Text(string='Notas')
    state = fields.Selection([('draft', 'Borrador'), ('done', 'Confirmado'), ('cancel', 'Cancelado')], default='draft')

    @api.depends('product_id')
    def _compute_unit_price(self):
        for rec in self:
            rec.unit_price = rec.product_id.list_price if rec.product_id else 0.0

    @api.depends('quantity', 'unit_price')
    def _compute_total_price(self):
        for rec in self:
            rec.total_price = (rec.quantity or 0.0) * (rec.unit_price or 0.0)

    def action_confirm(self):
        """Confirmar la venta"""
        for rec in self:
            if rec.state != 'done':
                rec.state = 'done'
                _logger.info('sale.order.action_confirm: confirmed sale id=%s product=%s qty=%s', rec.id, rec.product_id.id, rec.quantity)
        return True

    def write(self, vals):
        """Permitir cambios de estado sin restricciones"""
        return super(SalesAIPrediction, self).write(vals)

    def action_predict_sales_from_menu(self):
        """Llamar predicción desde el menú sin selección"""
        return self.browse([]).action_predict_sales()

    def action_recommend_products_from_menu(self):
        """Llamar recomendaciones desde el menú sin selección"""
        return self.browse([]).action_recommend_products()

    def action_recommend_products(self):
        """Recomendar productos para comprar según temporada y fechas festivas"""
        today = fields.Date.today()
        current_month = today.month
        current_year = today.year
        
        # Definir temporadas y fechas festivas de Perú
        festivities = self._get_peru_festivities(current_month, current_year)
        season_info = self._get_season_info(current_month)
        
        # Obtener productos más vendidos por mes histórico
        last_year_same_month = today.replace(year=current_year - 1)
        month_start = last_year_same_month.replace(day=1)
        
        if current_month == 12:
            month_end = last_year_same_month.replace(day=31)
        else:
            next_month = last_year_same_month.replace(month=current_month + 1, day=1)
            month_end = next_month - timedelta(days=1)
        
        # Buscar ventas del mismo mes el año pasado
        historical_sales = self.search([
            ('state', '=', 'done'),
            ('date', '>=', month_start),
            ('date', '<=', month_end)
        ])
        
        # Analizar productos por ventas
        product_stats = {}
        for sale in historical_sales:
            product = sale.product_id
            if product.id not in product_stats:
                product_stats[product.id] = {
                    'product': product,
                    'quantity': 0,
                    'revenue': 0,
                    'count': 0
                }
            product_stats[product.id]['quantity'] += sale.quantity
            product_stats[product.id]['revenue'] += sale.total_price
            product_stats[product.id]['count'] += 1
        
        # Ordenar por revenue
        top_products = sorted(product_stats.values(), 
                            key=lambda x: x['revenue'], 
                            reverse=True)[:5]
        
        # Crear wizard de recomendaciones
        wizard = self.env['product.recommendation.wizard'].create({
            'current_month_name': self._get_month_name(current_month),
            'season_name': season_info['name'],
            'season_description': season_info['description'],
            'festivities': festivities,
            'has_historical_data': len(top_products) > 0,
        })
        
        # Crear líneas de productos históricos
        for i, product_data in enumerate(top_products, 1):
            self.env['product.recommendation.line'].create({
                'wizard_id': wizard.id,
                'product_id': product_data['product'].id,
                'rank': i,
                'quantity_sold': product_data['quantity'],
                'revenue': product_data['revenue'],
                'sales_count': product_data['count'],
                'recommendation_type': 'historical'
            })
        
        # Crear líneas de recomendaciones estacionales
        seasonal_recommendations = self._get_seasonal_recommendations(current_month)
        for i, rec in enumerate(seasonal_recommendations, len(top_products) + 1):
            self.env['product.recommendation.line'].create({
                'wizard_id': wizard.id,
                'product_name': rec['name'],
                'rank': i,
                'category': rec['category'],
                'reason': rec['reason'],
                'recommendation_type': 'seasonal'
            })
        
        return {
            'name': 'Recomendaciones de Productos para Comprar',
            'type': 'ir.actions.act_window',
            'res_model': 'product.recommendation.wizard',
            'view_mode': 'form',
            'res_id': wizard.id,
            'target': 'new',
        }
    
    def _get_peru_festivities(self, month, year):
        """Obtener festividades peruanas del mes"""
        festivities_map = {
            1: "Año Nuevo • Verano en la costa",
            2: "San Valentín (14) • Carnavales • Temporada de playa",
            3: "Fin de verano • Semana Santa (variable)",
            4: "Semana Santa (variable) • Otoño",
            5: "Día de la Madre (2do domingo) • Fiestas patronales",
            6: "Día del Padre (3er domingo) • Inti Raymi (24) • Inicio de invierno",
            7: "Fiestas Patrias (28-29) • Mes patrio",
            8: "Santa Rosa de Lima (30) • Temporada turística",
            9: "Primavera • Señor de los Milagros (octubre cercano)",
            10: "Señor de los Milagros • Día de la Canción Criolla (31)",
            11: "Halloween (1) • Puno y Día de Todos los Santos • Black Friday",
            12: "Navidad (25) • Año Nuevo (31) • Verano • Vacaciones"
        }
        return festivities_map.get(month, "")
    
    def _get_season_info(self, month):
        """Obtener información de temporada"""
        seasons = {
            1: {"name": "Verano", "description": "Temporada de playa, calor intenso, vacaciones"},
            2: {"name": "Verano", "description": "Carnavales, playas, bebidas frías"},
            3: {"name": "Verano/Otoño", "description": "🍂 Transición, fin de vacaciones"},
            4: {"name": "Otoño", "description": "Clima templado, Semana Santa"},
            5: {"name": "Otoño", "description": "Temporada fría comienza"},
            6: {"name": "Invierno", "description": "Frío en sierra, temporada de sopas"},
            7: {"name": "Invierno", "description": "Fiestas Patrias, comida tradicional"},
            8: {"name": "Invierno", "description": "Frío intenso en zonas altas"},
            9: {"name": "Primavera", "description": "Clima agradable, flores"},
            10: {"name": "Primavera", "description": "Octubre morado, procesiones"},
            11: {"name": "Primavera", "description": "Preparación para verano y navidad"},
            12: {"name": "Verano", "description": "Navidad, Año Nuevo, vacaciones, calor"}
        }
        return seasons.get(month, {"name": "N/A", "description": "N/A"})
    
    def _get_seasonal_recommendations(self, month):
        """Recomendaciones específicas por mes para Perú"""
        recommendations = {
            1: [  # Enero - Verano
                {"name": "Bebidas frías (gaseosas, jugos, agua)", "category": "Bebidas", 
                 "reason": "Verano intenso en costa, alta demanda de hidratación"},
                {"name": "Bloqueador solar, sombreros", "category": "Cuidado personal", 
                 "reason": "Protección solar esencial en verano"},
                {"name": "Helados y productos congelados", "category": "Alimentos", 
                 "reason": "Calor intenso aumenta consumo"},
                {"name": "Ropa de playa (trajes de baño, sandalias)", "category": "Vestimenta", 
                 "reason": "Temporada de playa en su peak"},
            ],
            2: [  # Febrero - Verano/Carnavales
                {"name": "Globos de agua, pinturas faciales", "category": "Juguetes/Fiesta", 
                 "reason": "Carnavales - juego con agua y pintura"},
                {"name": "Chocolate, peluches, tarjetas", "category": "Regalos", 
                 "reason": "San Valentín (14 de febrero)"},
                {"name": "Flores (rosas especialmente)", "category": "Decoración", 
                 "reason": "Alta demanda para San Valentín"},
            ],
            3: [  # Marzo - Semana Santa
                {"name": "Pescados y mariscos", "category": "Alimentos", 
                 "reason": "Semana Santa - no se come carne roja"},
                {"name": "Fanesca, ingredientes tradicionales", "category": "Alimentos", 
                 "reason": "Platos típicos de Semana Santa"},
                {"name": "Útiles escolares", "category": "Educación", 
                 "reason": "Inicio de clases en muchos colegios"},
            ],
            4: [  # Abril - Otoño
                {"name": "Ropa de entretiempo", "category": "Vestimenta", 
                 "reason": "Clima templado, transición al frío"},
                {"name": "Paraguas, impermeables", "category": "Accesorios", 
                 "reason": "Inicio de lluvias en algunas zonas"},
            ],
            5: [  # Mayo - Día de la Madre
                {"name": "Regalos para mamá (perfumes, joyas)", "category": "Regalos", 
                 "reason": "Día de la Madre (2do domingo de mayo)"},
                {"name": "Flores, tarjetas, chocolates", "category": "Detalles", 
                 "reason": "Obsequios tradicionales para madres"},
                {"name": "Electrodomésticos pequeños", "category": "Hogar", 
                 "reason": "Regalos prácticos populares"},
            ],
            6: [  # Junio - Día del Padre/Invierno
                {"name": "Regalos para papá (herramientas, ropa)", "category": "Regalos", 
                 "reason": "Día del Padre (3er domingo de junio)"},
                {"name": "Ropa de invierno (chompas, abrigos)", "category": "Vestimenta", 
                 "reason": "Inicio del invierno, frío en sierra"},
                {"name": "Bebidas calientes (café, chocolate)", "category": "Bebidas", 
                 "reason": "Clima frío aumenta consumo"},
            ],
            7: [  # Julio - Fiestas Patrias
                {"name": "Banderas, escarapelas peruanas", "category": "Decoración", 
                 "reason": "Fiestas Patrias (28-29 de julio)"},
                {"name": "Ingredientes anticuchos, chicha", "category": "Alimentos", 
                 "reason": "Comida tradicional peruana"},
                {"name": "Polos blancos y rojos", "category": "Vestimenta", 
                 "reason": "Colores patrios - alta demanda"},
                {"name": "Pirotécnicos (según permiso)", "category": "Festivos", 
                 "reason": "Celebraciones patrias"},
            ],
            8: [  # Agosto - Invierno
                {"name": "Ropa térmica, frazadas", "category": "Textil", 
                 "reason": "Mes más frío del año"},
                {"name": "Ingredientes sopas y caldos", "category": "Alimentos", 
                 "reason": "Alta demanda de comida caliente"},
            ],
            9: [  # Septiembre - Primavera
                {"name": "Flores, plantas ornamentales", "category": "Decoración", 
                 "reason": "Primavera - temporada de flores"},
                {"name": "Ropa ligera primaveral", "category": "Vestimenta", 
                 "reason": "Clima mejora, transición al calor"},
            ],
            10: [  # Octubre - Señor de los Milagros
                {"name": "Hábitos morados, imágenes religiosas", "category": "Religioso", 
                 "reason": "Mes morado - procesiones del Señor de los Milagros"},
                {"name": "Turrón de Doña Pepa", "category": "Dulces", 
                 "reason": "Dulce tradicional del mes morado"},
                {"name": "Velas moradas, flores", "category": "Decoración", 
                 "reason": "Altares y procesiones"},
            ],
            11: [  # Noviembre - Pre-Navidad
                {"name": "Disfraces Halloween", "category": "Festivos", 
                 "reason": "Halloween (1 de noviembre) cada vez más popular"},
                {"name": "Decoración navideña temprana", "category": "Decoración", 
                 "reason": "Inicio de temporada navideña"},
                {"name": "Productos ofertas Black Friday", "category": "Varios", 
                 "reason": "Black Friday (último viernes)"},
            ],
            12: [  # Diciembre - Navidad
                {"name": "Panetón, chocolate navideño", "category": "Alimentos", 
                 "reason": "Productos tradicionales de Navidad"},
                {"name": "Decoración navideña (árbol, luces)", "category": "Decoración", 
                 "reason": "Navidad - alta demanda decorativa"},
                {"name": "Juguetes para niños", "category": "Juguetes", 
                 "reason": "Regalos de Navidad y Año Nuevo"},
                {"name": "Ropa elegante, zapatos", "category": "Vestimenta", 
                 "reason": "Fiestas de fin de año"},
                {"name": "Licores, vinos, sidra", "category": "Bebidas", 
                 "reason": "Celebraciones navideñas y Año Nuevo"},
                {"name": "Fuegos artificiales", "category": "Festivos", 
                 "reason": "Año Nuevo - tradición de pirotécnicos"},
            ]
        }
        return recommendations.get(month, [])
    
    def _get_month_name(self, month):
        """Obtener nombre del mes en español"""
        months = {
            1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
            5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
            9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
        }
        return months.get(month, "")

    @api.model
    def get_pos_sales_today(self):
        """Obtener ventas de POS de hoy desde pos.order"""
        try:
            today = fields.Date.today().strftime('%Y-%m-%d')
            pos_orders = self.env['pos.order'].search([
                ('date_order', '>=', today + ' 00:00:00'),
                ('date_order', '<=', today + ' 23:59:59'),
                ('state', 'in', ['paid', 'done'])
            ])
            
            if not pos_orders:
                return {
                    'success': True,
                    'count': 0,
                    'total': 0.0,
                    'average': 0.0,
                    'orders': []
                }
            
            total_amount = sum(pos_orders.mapped('amount_total'))
            
            orders_list = []
            for order in pos_orders:
                orders_list.append({
                    'id': order.id,
                    'name': order.name,
                    'amount': order.amount_total,
                    'items_count': len(order.lines),
                    'date': order.date_order.strftime('%H:%M:%S') if order.date_order else ''
                })
            
            return {
                'success': True,
                'count': len(pos_orders),
                'total': total_amount,
                'average': total_amount / len(pos_orders) if pos_orders else 0.0,
                'orders': orders_list
            }
        except Exception as e:
            _logger.error('Error getting POS sales: %s', str(e))
            return {
                'success': False,
                'error': str(e),
                'count': 0,
                'total': 0.0
            }

    @api.model
    def get_pos_sales_monthly(self, year=None, month=None):
        """Obtener ventas de POS del mes actual o especificado"""
        try:
            if not year:
                year = datetime.now().year
            if not month:
                month = datetime.now().month
            
            # Crear rango de fechas
            first_day = datetime(year, month, 1)
            if month == 12:
                last_day = datetime(year + 1, 1, 1) - timedelta(days=1)
            else:
                last_day = datetime(year, month + 1, 1) - timedelta(days=1)
            
            pos_orders = self.env['pos.order'].search([
                ('date_order', '>=', first_day.strftime('%Y-%m-%d 00:00:00')),
                ('date_order', '<=', last_day.strftime('%Y-%m-%d 23:59:59')),
                ('state', 'in', ['paid', 'done'])
            ])
            
            total_amount = sum(pos_orders.mapped('amount_total'))
            total_items = sum(pos_orders.mapped(lambda o: len(o.lines)))
            
            # Agrupar por día
            daily_sales = {}
            for order in pos_orders:
                day_key = order.date_order.strftime('%Y-%m-%d') if order.date_order else ''
                if day_key not in daily_sales:
                    daily_sales[day_key] = {'count': 0, 'total': 0.0}
                daily_sales[day_key]['count'] += 1
                daily_sales[day_key]['total'] += order.amount_total
            
            return {
                'success': True,
                'month': month,
                'year': year,
                'total_orders': len(pos_orders),
                'total_amount': total_amount,
                'total_items': total_items,
                'average_order': total_amount / len(pos_orders) if pos_orders else 0.0,
                'daily_sales': daily_sales
            }
        except Exception as e:
            _logger.error('Error getting monthly POS sales: %s', str(e))
            return {
                'success': False,
                'error': str(e),
                'total_orders': 0,
                'total_amount': 0.0
            }

    @api.model
    def get_product_stock(self, product_name=None):
        """Obtener stock buscando en product.template"""
        try:
            _logger.info('START get_product_stock')
            _logger.info('PARAM1 product_name=%s (type=%s)', repr(product_name), type(product_name).__name__)
            
            # Convertir a string
            product_name = str(product_name).strip() if product_name else ''
            _logger.info('PARAM2 after strip=%s', repr(product_name))
            
            products_list = []
            
            if not product_name:
                _logger.info('NO SEARCH - returning empty')
                products = []
            else:
                _logger.info('SEARCHING FOR: %s', product_name)
                all_products = self.env['product.template'].search([('active', '=', True)], limit=500)
                _logger.info('TOTAL PRODUCTS IN DB: %d', len(all_products))
                
                # Normalizar búsqueda: remover acentos y minúsculas
                search_normalized = product_name.lower()
                search_normalized = search_normalized.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
                search_normalized = search_normalized.replace('ñ', 'n')
                _logger.info('NORMALIZED SEARCH: %s', search_normalized)
                
                products = []
                
                # Buscar en todos los productos
                for product in all_products:
                    product_name_norm = product.name.lower() if product.name else ''
                    product_name_norm = product_name_norm.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
                    product_name_norm = product_name_norm.replace('ñ', 'n')
                    
                    if search_normalized in product_name_norm:
                        _logger.info('MATCH FOUND: %s (search "%s" in "%s")', product.name, search_normalized, product_name_norm)
                        products.append(product)
                
                _logger.info('TOTAL MATCHES: %d', len(products))
            
            # Convertir a lista de datos
            for product in products:
                qty = product.qty_available if hasattr(product, 'qty_available') else 0
                products_list.append({
                    'id': product.id,
                    'name': product.name,
                    'sku': product.default_code or '',
                    'qty_available': qty,
                    'qty_reserved': product.qty_reserved if hasattr(product, 'qty_reserved') else 0,
                    'uom': product.uom_id.name if product.uom_id else 'Unidad',
                    'price': float(product.list_price or 0),
                    'cost': float(product.standard_price or 0),
                    'warning': 'LOW' if qty < 10 else ('OUT' if qty <= 0 else 'OK')
                })
            
            _logger.info('END get_product_stock - FOUND %d products', len(products_list))
            return {'success': True, 'found': len(products_list), 'products': products_list}
            
        except Exception as e:
            _logger.error('EXCEPTION in get_product_stock: %s', str(e), exc_info=True)
            return {'success': False, 'error': str(e), 'found': 0, 'products': []
            }

    @api.model
    def get_all_products_list(self):
        """Obtener lista de TODOS los productos desde product.template (ordenados por nombre)"""
        try:
            _logger.info('=== LISTANDO TODOS LOS PRODUCTOS DE product.template ===')
            
            # Obtener todos los productos activos, ordenados por nombre
            all_products = self.env['product.template'].search([
                ('active', '=', True),
            ], limit=500, order='name asc')
            
            _logger.info('Total de product.template encontrados: %d', len(all_products))
            
            products_list = []
            for product in all_products:
                try:
                    # Obtener stock desde product.template
                    qty_available = product.qty_available if hasattr(product, 'qty_available') else 0
                    
                    product_data = {
                        'id': product.id,
                        'name': product.name,
                        'sku': product.default_code or '',
                        'type': product.type if hasattr(product, 'type') else 'product',
                        'qty_available': qty_available,
                        'qty_reserved': product.qty_reserved if hasattr(product, 'qty_reserved') else 0,
                        'uom': product.uom_id.name if product.uom_id else 'Unidad',
                        'price': float(product.list_price or 0),
                        'active': product.active,
                    }
                    products_list.append(product_data)
                    
                    if len(products_list) <= 20:  # Log solo de los primeros 20
                        _logger.info('Producto: %s (SKU:%s, Stock:%s)', 
                                   product.name, product.default_code or 'N/A', qty_available)
                except Exception as e:
                    _logger.error('Error procesando producto: %s', str(e))
            
            _logger.info('Total de productos listados: %d', len(products_list))
            return {
                'success': True,
                'total': len(products_list),
                'products': products_list
            }
        except Exception as e:
            _logger.error('Error en get_all_products_list: %s', str(e), exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'total': 0,
                'products': []
            }

    @api.model
    def get_low_stock_products(self, threshold=10):
        """Obtener productos con stock bajo en product.template"""
        try:
            _logger.info('=== BÚSQUEDA DE PRODUCTOS CON STOCK BAJO (threshold=%d) ===', threshold)
            
            # Buscar en product.template
            products = self.env['product.template'].search([
                ('qty_available', '<=', threshold),
                ('qty_available', '>', 0),
                ('active', '=', True),
            ], order='qty_available asc')
            
            _logger.info('Productos encontrados: %d', len(products))
            
            products_list = []
            for product in products:
                try:
                    qty_available = product.qty_available if hasattr(product, 'qty_available') else 0
                    
                    products_list.append({
                        'id': product.id,
                        'name': product.name,
                        'qty_available': qty_available,
                        'uom': product.uom_id.name if product.uom_id else 'Unidad',
                        'price': float(product.list_price or 0)
                    })
                except Exception as e:
                    _logger.error('Error procesando producto con stock bajo: %s', str(e))
            
            return {
                'success': True,
                'count': len(products_list),
                'products': products_list,
                'threshold': threshold
            }
        except Exception as e:
            _logger.error('Error getting low stock products: %s', str(e))
            return {
                'success': False,
                'error': str(e),
                'count': 0,
                'products': []
            }

    @api.model
    def get_out_of_stock_products(self):
        """Obtener productos sin stock en product.template"""
        try:
            _logger.info('=== BÚSQUEDA DE PRODUCTOS SIN STOCK ===')
            
            # Buscar en product.template
            products = self.env['product.template'].search([
                ('qty_available', '<=', 0),
                ('active', '=', True),
            ], order='name asc')
            
            _logger.info('Productos sin stock encontrados: %d', len(products))
            
            products_list = []
            for product in products:
                try:
                    qty_available = product.qty_available if hasattr(product, 'qty_available') else 0
                    
                    products_list.append({
                        'id': product.id,
                        'name': product.name,
                        'qty_available': qty_available,
                        'uom': product.uom_id.name if product.uom_id else 'Unidad'
                    })
                except Exception as e:
                    _logger.error('Error procesando producto sin stock: %s', str(e))
            
            return {
                'success': True,
                'count': len(products_list),
                'products': products_list
            }
        except Exception as e:
            _logger.error('Error getting out of stock products: %s', str(e))
            return {
                'success': False,
                'error': str(e),
                'count': 0,
                'products': []
            }

    def action_predict_sales(self):
        """Acción para predecir ventas futuras desde pos.order"""
        if not SKLEARN_AVAILABLE:
            raise UserError('Scikit-learn no está instalado. Por favor instala: pip install scikit-learn numpy')
        
        # Obtener ventas de POS de los últimos 6 meses
        six_months_ago = datetime.now() - timedelta(days=180)
        six_months_ago_str = six_months_ago.strftime('%Y-%m-%d 00:00:00')
        
        # Buscar órdenes en estados finalizados: paid, done, posted, CONTABILIZADO
        pos_orders = self.env['pos.order'].search([
            ('date_order', '>=', six_months_ago_str),
            ('state', 'in', ['paid', 'done', 'posted', 'CONTABILIZADO'])
        ], order='date_order asc')
        
        if len(pos_orders) < 1:
            raise UserError(
                f'Se necesitan al menos 1 órdenes de POS confirmadas para hacer predicciones. '
                f'Se encontraron solo {len(pos_orders)} órdenes en los últimos 6 meses.'
            )
        
        # Preparar datos para el modelo
        dates = []
        amounts = []
        
        # Agrupar ventas por día
        sales_by_date = {}
        for order in pos_orders:
            date_str = order.date_order.strftime('%Y-%m-%d') if order.date_order else ''
            if not date_str:
                continue
            if date_str not in sales_by_date:
                sales_by_date[date_str] = {'total': 0, 'count': 0}
            sales_by_date[date_str]['total'] += order.amount_total
            sales_by_date[date_str]['count'] += 1
        
        if len(sales_by_date) < 1:
            raise UserError(
                'Se necesitan al menos 1 días con ventas para hacer predicciones precisas. '
                'Por favor espera a tener más histórico de ventas.'
            )
        
        # Convertir a arrays para el modelo
        base_date = min(datetime.strptime(d, '%Y-%m-%d').date() for d in sales_by_date.keys())
        for date_str, data in sorted(sales_by_date.items()):
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            days_since_start = (date_obj - base_date).days
            dates.append(days_since_start)
            amounts.append(data['total'])
        
        X = np.array(dates).reshape(-1, 1)
        y_amount = np.array(amounts)
        
        # Entrenar modelo
        model_amount = LinearRegression()
        model_amount.fit(X, y_amount)
        
        # Predecir próximos 30 días
        today = datetime.now().date()
        days_since_start = (today - base_date).days
        
        predictions = []
        for i in range(1, 31):
            future_day = days_since_start + i
            pred_amount = max(0, model_amount.predict([[future_day]])[0])
            pred_date = today + timedelta(days=i)
            
            predictions.append({
                'date': pred_date,
                'amount': pred_amount
            })
        
        # Calcular estadísticas
        avg_daily_sales = sum(amounts) / len(amounts) if amounts else 0
        total_sales = sum(amounts)
        
        # Calcular tendencia
        slope_amount = model_amount.coef_[0]
        if slope_amount > 1:
            trend = 'creciente'
        elif slope_amount < -1:
            trend = 'decreciente'
        else:
            trend = 'estable'
        
        # Predicción mensual
        monthly_prediction = sum([p['amount'] for p in predictions])
        
        # Calcular tasa de crecimiento
        if total_sales > 0:
            growth_rate = ((monthly_prediction - total_sales) / total_sales) * 100
        else:
            growth_rate = 0
        
        # Crear wizard
        wizard = self.env['sale.prediction.wizard'].create({
            'historical_total': total_sales,
            'historical_avg': avg_daily_sales,
            'historical_quantity': len(sales_by_date),  # Número de días con ventas
            'trend': trend,
            'total_predicted': monthly_prediction,
            'quantity_predicted': len(sales_by_date),  # Estimado de días con ventas
            'avg_daily': monthly_prediction / 30,
            'growth_rate': growth_rate,
        })
        
        # Crear líneas de predicción para 90 días (permite filtrar 7, 30, 90)
        for pred in predictions[:90]:
            self.env['sale.prediction.line'].create({
                'wizard_id': wizard.id,
                'date': pred['date'],
                'predicted_amount': pred['amount'],
                'predicted_quantity': 1,  # POS no tiene cantidad, usamos 1
            })
        
        return {
            'name': 'Predicción de Ventas con IA',
            'type': 'ir.actions.act_window',
            'res_model': 'sale.prediction.wizard',
            'view_mode': 'form',
            'res_id': wizard.id,
            'target': 'new',
        }


class SalePredictionWizard(models.TransientModel):
    _name = 'sale.prediction.wizard'
    _description = 'Wizard de Predicción de Ventas'

    # 🤖 NUEVO CAMPO PARA EL ROBOT
    robot_display = fields.Char(string="Robot Display", default="")
    
    # Datos históricos
    historical_total = fields.Monetary(string='Total Histórico', currency_field='currency_id')
    historical_avg = fields.Monetary(string='Promedio Histórico', currency_field='currency_id')
    historical_quantity = fields.Float(string='Cantidad Histórica')
    
    # Predicciones
    total_predicted = fields.Monetary(string='Total Predicho', currency_field='currency_id')
    quantity_predicted = fields.Float(string='Cantidad Predicha')
    avg_daily = fields.Monetary(string='Promedio Diario Predicho', currency_field='currency_id')
    
    # Métricas
    trend = fields.Selection([
        ('creciente', 'Creciente ↗'),
        ('decreciente', 'Decreciente ↘'),
        ('estable', 'Estable →')
    ], string='Tendencia')
    growth_rate = fields.Float(string='Tasa de Crecimiento (%)')
    
    # Líneas de predicción
    prediction_line_ids = fields.One2many('sale.prediction.line', 'wizard_id', string='Predicciones')
    
    # Filtro de período
    period_filter = fields.Selection([
        ('7days', 'Últimos 7 Días'),
        ('1month', 'Mes (30 Días)'),
        ('3months', '3 Meses (90 Días)')
    ], string='Filtrar Por', default='7days')
    
    # Datos para gráficos (JSON)
    chart_data = fields.Text(string='Datos de Gráfico', help='Datos JSON para gráficos')
    
    # Campo técnico
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)

    def action_close(self):
        return {'type': 'ir.actions.act_window_close'}
    
    def action_export_predictions(self):
        """Exportar predicciones a CSV o similar"""
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Exportación',
                'message': 'Función de exportación disponible próximamente',
                'type': 'info',
                'sticky': False,
            }
        }


class SalePredictionLine(models.TransientModel):
    _name = 'sale.prediction.line'
    _description = 'Línea de Predicción'
    _order = 'date'

    wizard_id = fields.Many2one('sale.prediction.wizard', string='Wizard', required=True, ondelete='cascade')
    date = fields.Date(string='Fecha')
    predicted_amount = fields.Monetary(string='Monto Predicho', currency_field='currency_id')
    predicted_quantity = fields.Float(string='Cantidad Predicha')
    currency_id = fields.Many2one('res.currency', related='wizard_id.currency_id')


class ProductRecommendationWizard(models.TransientModel):
    _name = 'product.recommendation.wizard'
    _description = 'Wizard de Recomendación de Productos'

    current_month_name = fields.Char(string='Mes Actual')
    season_name = fields.Char(string='Temporada')
    season_description = fields.Text(string='Descripción de Temporada')
    festivities = fields.Text(string='Festividades del Mes')
    has_historical_data = fields.Boolean(string='Tiene Datos Históricos')
    
    recommendation_line_ids = fields.One2many(
        'product.recommendation.line', 
        'wizard_id', 
        string='Recomendaciones'
    )
    
    def action_close(self):
        return {'type': 'ir.actions.act_window_close'}


class ProductRecommendationLine(models.TransientModel):
    _name = 'product.recommendation.line'
    _description = 'Línea de Recomendación de Producto'
    _order = 'rank'

    wizard_id = fields.Many2one('product.recommendation.wizard', required=True, ondelete='cascade')
    rank = fields.Integer(string='#')
    
    # Para productos existentes (históricos)
    product_id = fields.Many2one('product.product', string='Producto')
    quantity_sold = fields.Float(string='Cantidad Vendida (año pasado)')
    revenue = fields.Monetary(string='Ingresos Generados', currency_field='currency_id')
    sales_count = fields.Integer(string='Número de Ventas')
    
    # Para recomendaciones estacionales (sin producto específico)
    product_name = fields.Char(string='Producto/Categoría Recomendada')
    category = fields.Char(string='Categoría')
    reason = fields.Text(string='Razón de Recomendación')
    
    recommendation_type = fields.Selection([
        ('historical', 'Basado en Historial'),
        ('seasonal', 'Recomendación Estacional')
    ], string='Tipo', default='seasonal')
    
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
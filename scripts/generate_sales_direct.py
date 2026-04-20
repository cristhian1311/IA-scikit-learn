#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script STANDALONE para generar datos históricos de Odoo
Conecta via XML-RPC (sin necesidad de odoo shell)

Uso:
    python generate_sales_direct.py --host localhost --port 8069 --db nombre_bd --user admin --password admin

Requisitos:
    pip install xmlrpc
"""

import argparse
import xmlrpc.client
import random
from datetime import datetime, timedelta
import sys


class OdooSalesDataGenerator:
    """Generador de datos para Odoo via XML-RPC"""
    
    def __init__(self, host, port, db, username, password):
        self.host = host
        self.port = port
        self.db = db
        self.username = username
        self.password = password
        
        # URLs de conexión
        self.common_url = f'http://{host}:{port}/xmlrpc/2/common'
        self.object_url = f'http://{host}:{port}/xmlrpc/2/object'
        
        self.uid = None
        self.auth_token = None
        
    def connect(self):
        """Conectar a Odoo"""
        print(f"🔗 Conectando a {self.host}:{self.port}/{self.db}...")
        
        try:
            # Autenticar
            common = xmlrpc.client.ServerProxy(self.common_url)
            self.uid = common.authenticate(self.db, self.username, self.password, {})
            
            if not self.uid:
                print("❌ Error: Credenciales inválidas")
                return False
            
            print(f"✅ Autenticado como: {self.username} (UID: {self.uid})")
            return True
            
        except Exception as e:
            print(f"❌ Error de conexión: {e}")
            return False
    
    def create_sales_data(self, years=5, total_orders=10000, batch_size=100):
        """Crear datos de ventas"""
        
        print(f"\n📊 Generando {total_orders:,} órdenes de {years} años...")
        
        models = xmlrpc.client.ServerProxy(self.object_url)
        
        today = datetime.now().date()
        start_date = today - timedelta(days=365 * years)
        
        # Factores estacionales
        seasonal_factors = {
            1: 1.30, 2: 1.10, 3: 0.90, 4: 0.85, 5: 1.20, 6: 1.15,
            7: 1.40, 8: 0.80, 9: 0.90, 10: 1.25, 11: 1.30, 12: 1.50
        }
        
        weekday_factors = {0: 0.7, 1: 0.8, 2: 0.85, 3: 0.9, 4: 1.2, 5: 1.4, 6: 1.1}
        
        # Obtener sesión y partners
        try:
            sessions = models.execute_kw(
                self.db, self.uid, self.password, 'pos.session', 'search', [[]], 
                {'limit': 5}
            )
            session_id = sessions[0] if sessions else None
            
            partners = models.execute_kw(
                self.db, self.uid, self.password, 'res.partner', 'search',
                [[('is_company', '=', False)]],
                {'limit': 100}
            )
            
            print(f"   Sesión POS: {session_id}")
            print(f"   Clientes disponibles: {len(partners)}")
            
        except Exception as e:
            print(f"⚠️  {e}")
            session_id = None
            partners = []
        
        # Generar y insertar órdenes
        current_date = start_date
        order_counter = 0
        orders_batch = []
        
        days_total = (today - start_date).days
        orders_per_day = total_orders / days_total
        
        while current_date <= today and order_counter < total_orders:
            
            day_of_week = current_date.weekday()
            month = current_date.month
            
            # Calcular órdenes del día
            daily_mult = random.gauss(1.0, 0.3)
            daily_mult = max(0.1, min(3.0, daily_mult))
            
            orders_today = int(
                orders_per_day * daily_mult * 
                weekday_factors[day_of_week] * 
                seasonal_factors[month]
            )
            
            if orders_today == 0:
                orders_today = 1 if random.random() > 0.5 else 0
            
            # Crear órdenes
            for idx in range(orders_today):
                if order_counter >= total_orders:
                    break
                
                hour = random.randint(8, 20)
                minute = random.randint(0, 59)
                order_dt = datetime.combine(
                    current_date,
                    datetime.min.time().replace(hour=hour, minute=minute)
                ).isoformat()
                
                # Monto
                sale_type = random.choices(
                    ['small', 'medium', 'large'],
                    weights=[0.5, 0.35, 0.15]
                )[0]
                
                if sale_type == 'small':
                    amount = random.uniform(10, 80)
                elif sale_type == 'medium':
                    amount = random.uniform(80, 300)
                else:
                    amount = random.uniform(300, 1500)
                
                amount = round(amount * random.uniform(0.95, 1.05), 2)
                
                order_vals = {
                    'name': f'POS/{current_date.strftime("%Y%m%d")}/{idx:03d}',
                    'date_order': order_dt,
                    'amount_total': amount,
                    'amount_paid': amount,
                    'amount_tax': round(amount * 0.18, 2),
                    'state': 'paid',
                }
                
                if session_id:
                    order_vals['session_id'] = session_id
                if partners:
                    order_vals['partner_id'] = random.choice(partners)
                
                orders_batch.append(order_vals)
                order_counter += 1
                
                # Insertar lotes
                if len(orders_batch) >= batch_size:
                    try:
                        models.execute_kw(
                            self.db, self.uid, self.password,
                            'pos.order', 'create', [orders_batch]
                        )
                        print(f"   ✓ Insertadas {len(orders_batch)} órdenes (Total: {order_counter}/{total_orders})")
                    except Exception as e:
                        print(f"   ⚠️  Error: {e}")
                    
                    orders_batch = []
            
            current_date += timedelta(days=1)
        
        # Último lote
        if orders_batch:
            try:
                models.execute_kw(
                    self.db, self.uid, self.password,
                    'pos.order', 'create', [orders_batch]
                )
                print(f"   ✓ Insertadas últimas {len(orders_batch)} órdenes")
            except Exception as e:
                print(f"   ⚠️  Error final: {e}")
        
        print(f"\n✅ COMPLETADO: {order_counter:,} órdenes generadas")
        return order_counter


def main():
    parser = argparse.ArgumentParser(
        description='Generar datos históricos de ventas en Odoo'
    )
    parser.add_argument('--host', default='localhost', help='Host de Odoo (default: localhost)')
    parser.add_argument('--port', type=int, default=8069, help='Puerto de Odoo (default: 8069)')
    parser.add_argument('--db', required=True, help='Nombre de base de datos')
    parser.add_argument('--user', default='admin', help='Usuario (default: admin)')
    parser.add_argument('--password', required=True, help='Contraseña')
    parser.add_argument('--years', type=int, default=5, help='Años de histórico (default: 5)')
    parser.add_argument('--orders', type=int, default=10000, help='Número de órdenes (default: 10000)')
    
    args = parser.parse_args()
    
    print("\n" + "="*70)
    print("🤖 GENERADOR DE DATOS HISTÓRICOS - ODOO (XML-RPC)")
    print("="*70)
    
    generator = OdooSalesDataGenerator(
        args.host, args.port, args.db, args.user, args.password
    )
    
    if not generator.connect():
        sys.exit(1)
    
    try:
        order_count = generator.create_sales_data(
            years=args.years,
            total_orders=args.orders
        )
        
        print("\n" + "="*70)
        print(f"✨ {order_count:,} órdenes generadas exitosamente!")
        print("="*70)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

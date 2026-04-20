{
    'name': 'AI Sales Predictions',
    'version': '1.0',
    'category': 'Sales',
    'author': 'Your Company',
    'description': 'AI-powered sales prediction and product recommendation module using Machine Learning. Integrates with Odoo standard models (POS, Product Stock).',
    'depends': ['base', 'product', 'web', 'point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'views/sales_views.xml',
        'report/prediction_report.xml',   # ← AGREGAR esta línea
    ],
    'assets': {
        'web.assets_backend': [
            # Templates XML
            'sales/static/src/xml/robot_templates.xml',
            # Robot widget (carga THREE.js desde CDN automáticamente)
            'sales/static/src/js/robot_init.js',
            # CSS
            'sales/static/src/css/robot.css',
        ],
    },
    'installable': True,
    'application': True,
}

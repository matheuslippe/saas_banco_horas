CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255),
    status_assinatura VARCHAR(50) DEFAULT 'inativa',
    plano VARCHAR(20) DEFAULT 'mensal',
    vitalicio_em TIMESTAMP WITH TIME ZONE,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE
);

CREATE TABLE registros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(50) NOT NULL DEFAULT 'extra',
    data_registro DATE NOT NULL,
    inicio TIME NOT NULL,
    fim TIME NOT NULL,
    observacao TEXT,
    horas_calculadas DECIMAL(10,2) NOT NULL
);

# Content Module

O módulo de conteúdo gerencia todo o ciclo de vida de conteúdos de mídia (filmes e séries), incluindo upload, processamento assíncrono, catalogação e streaming.

## Funcionalidades Principais

- **Gerenciamento de Filmes**: Upload, metadados e catalogação
- **Gerenciamento de Séries (TV Shows)**: Criação de séries com múltiplos episódios
- **Processamento de Vídeo**: Transcrição, resumo automático e classificação etária
- **Streaming**: Geração de URLs de streaming para reprodução
- **Integração Externa**: Busca de ratings externos (ex: TMDB)

## Arquitetura

Este módulo segue os princípios de arquitetura modular e é dividido em **sub-domínios**:

```
content/
├── content.module.ts           # Módulo principal
├── admin/                      # Sub-domínio: Administração de conteúdo
│   ├── core/
│   │   ├── model/
│   │   ├── service/
│   │   └── use-case/
│   ├── http/
│   │   ├── client/             # Clientes externos (TMDB)
│   │   └── rest/
│   ├── persistence/
│   └── queue/
│       ├── consumer/
│       └── producer/
├── catalog/                    # Sub-domínio: Catálogo e streaming
│   ├── core/use-case/
│   └── http/rest/
├── video-processor/            # Sub-domínio: Workers de processamento
│   ├── core/
│   │   ├── adapter/            # Interfaces de integração (AI/ML)
│   │   └── use-case/
│   ├── http/client/            # Clientes de IA (Gemini)
│   ├── persistence/
│   └── queue/
│       ├── consumer/           # Workers que processam jobs
│       └── producer/
└── shared/                     # Código compartilhado no domínio
    ├── core/
    ├── persistence/
    └── queue/
```

## Fluxos

### Fluxo Completo de Upload de Vídeo

O upload de vídeo é um processo que combina operações síncronas (upload e persistência) com processamento assíncrono em workers.

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Controller as AdminMovieController
    participant UseCase as CreateMovieUseCase
    participant ExternalAPI as ExternalMovieClient
    participant Repository as ContentRepository
    participant VideoProcessor as VideoProcessorService
    participant Producer as VideoProcessingJobProducer
    participant Queue as BullMQ Queues

    Note over Client,Queue: 📤 FASE 1: Upload Síncrono

    Client->>Controller: POST /admin/movie<br/>(video + thumbnail + metadata)
    Controller->>Controller: Validar arquivos<br/>(tamanho, tipo)
    Controller->>UseCase: execute(videoData)
    
    UseCase->>ExternalAPI: getRating(title)
    ExternalAPI-->>UseCase: rating (opcional)
    
    UseCase->>UseCase: Criar MovieContentModel<br/>com Video e Thumbnail
    UseCase->>Repository: saveMovie(contentModel)
    Repository-->>UseCase: content salvo (com IDs)
    
    Note over UseCase,Queue: 🚀 FASE 2: Disparo de Jobs Assíncronos
    
    UseCase->>VideoProcessor: processMetadataAndModeration(video)
    
    par Disparo Paralelo de Jobs
        VideoProcessor->>Producer: processRecommendation(video)
        Producer->>Queue: add(VIDEO_AGE_RECOMMENDATION)
    and
        VideoProcessor->>Producer: processTranscript(video)
        Producer->>Queue: add(VIDEO_TRANSCRIPT)
    and
        VideoProcessor->>Producer: processSummary(video)
        Producer->>Queue: add(VIDEO_SUMMARY)
    end
    
    Producer-->>VideoProcessor: jobIds
    VideoProcessor-->>UseCase: ✓ jobs enfileirados
    UseCase-->>Controller: MovieContentModel
    Controller-->>Client: 201 Created<br/>CreateVideoResponseDto
```

### Processamento Assíncrono nos Workers

```mermaid
sequenceDiagram
    autonumber
    participant Queue as BullMQ Queues
    participant AgeWorker as VideoAgeRecommendation<br/>Consumer
    participant TranscriptWorker as VideoTranscription<br/>Consumer
    participant SummaryWorker as VideoSummary<br/>Consumer
    participant AgeUseCase as SetAgeRecommendation<br/>UseCase
    participant TranscriptUseCase as TranscribeVideo<br/>UseCase
    participant SummaryUseCase as GenerateSummary<br/>UseCase
    participant AIAdapter as AI Adapters<br/>(Gemini)
    participant MetadataRepo as VideoMetadata<br/>Repository
    participant ContentQueue as Content Age<br/>Recommendation Queue
    participant ContentWorker as ContentAgeRecommendation<br/>Consumer
    participant ContentUseCase as SetAgeRecommendation<br/>ForContentUseCase
    participant ContentRepo as ContentRepository

    Note over Queue,ContentRepo: 🔄 FASE 3: Processamento Paralelo nos Workers

    par Worker: Age Recommendation
        Queue->>AgeWorker: job(videoId, url)
        AgeWorker->>AgeUseCase: execute(video)
        AgeUseCase->>AIAdapter: getAgeRecommendation(url)
        AIAdapter-->>AgeUseCase: {ageRating, explanation, categories}
        AgeUseCase->>MetadataRepo: save(metadata)
        AgeUseCase->>ContentQueue: processContentAgeRecommendation()
        AgeWorker-->>Queue: ✓ completed
    and Worker: Transcription
        Queue->>TranscriptWorker: job(videoId, url)
        TranscriptWorker->>TranscriptUseCase: execute(video)
        TranscriptUseCase->>AIAdapter: generateTranscript(url)
        AIAdapter-->>TranscriptUseCase: transcript text
        TranscriptUseCase->>MetadataRepo: save(metadata)
        TranscriptWorker-->>Queue: ✓ completed
    and Worker: Summary
        Queue->>SummaryWorker: job(videoId, url)
        SummaryWorker->>SummaryUseCase: execute(video)
        SummaryUseCase->>AIAdapter: generateSummary(url)
        AIAdapter-->>SummaryUseCase: summary text
        SummaryUseCase->>MetadataRepo: save(metadata)
        SummaryWorker-->>Queue: ✓ completed
    end

    Note over ContentQueue,ContentRepo: 🏷️ FASE 4: Atualização do Conteúdo

    ContentQueue->>ContentWorker: job(videoId, ageRecommendation)
    ContentWorker->>ContentUseCase: execute(videoId, ageRecommendation)
    ContentUseCase->>ContentRepo: findContentByVideoId()
    ContentRepo-->>ContentUseCase: content
    ContentUseCase->>ContentUseCase: setAgeRecommendation()
    ContentUseCase->>ContentRepo: saveMovieOrTvShow()
    ContentWorker-->>ContentQueue: ✓ completed
```

### Visão Geral do Fluxo

```mermaid
flowchart TB
    subgraph Upload["📤 Upload (Síncrono)"]
        A[Cliente envia vídeo] --> B[Controller valida arquivos]
        B --> C[CreateMovieUseCase]
        C --> D{Buscar rating externo?}
        D -->|Sim| E[ExternalMovieClient]
        E --> F[Criar modelo de conteúdo]
        D -->|Não| F
        F --> G[(Salvar no banco)]
    end

    subgraph Dispatch["🚀 Disparo de Jobs"]
        G --> H[VideoProcessorService]
        H --> I1[Job: Age Recommendation]
        H --> I2[Job: Transcript]
        H --> I3[Job: Summary]
    end

    subgraph Workers["⚙️ Workers (Assíncrono)"]
        subgraph AgeWorker["Worker: Age Recommendation"]
            I1 --> J1[Analisar vídeo com IA]
            J1 --> K1[Salvar metadata]
            K1 --> L1[Publicar para Content Queue]
        end
        
        subgraph TranscriptWorker["Worker: Transcript"]
            I2 --> J2[Extrair áudio]
            J2 --> K2[Gerar transcrição]
            K2 --> L2[Salvar metadata]
        end
        
        subgraph SummaryWorker["Worker: Summary"]
            I3 --> J3[Analisar conteúdo]
            J3 --> K3[Gerar resumo]
            K3 --> L3[Salvar metadata]
        end
    end

    subgraph ContentUpdate["🏷️ Atualização de Conteúdo"]
        L1 --> M[ContentAgeRecommendation Consumer]
        M --> N[Atualizar ageRecommendation no Content]
        N --> O[(Salvar Content)]
    end

    style Upload fill:#e3f2fd
    style Dispatch fill:#fff3e0
    style Workers fill:#f3e5f5
    style ContentUpdate fill:#e8f5e9
```

## Filas (Queues)

| Fila | Produtor | Consumidor | Descrição |
|------|----------|------------|-----------|
| `video-age-recommendation` | VideoProcessingJobProducer | VideoAgeRecommendationConsumer | Análise de classificação etária |
| `video-transcript` | VideoProcessingJobProducer | VideoTranscriptionConsumer | Transcrição de áudio |
| `video-summary` | VideoProcessingJobProducer | VideoSummaryConsumer | Geração de resumo |
| `content-age-recommendation` | ContentAgeRecommendationQueueProducer | ContentAgeRecommendationConsumer | Atualização do conteúdo |

## API Endpoints

### Admin - Filmes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/admin/movie` | Upload de filme com vídeo e thumbnail |

### Admin - Séries (TV Shows)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/admin/tv-show` | Criar série com thumbnail |
| `POST` | `/admin/tv-show/:contentId/upload-episode` | Upload de episódio |

### Catalog - Streaming

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/catalog/stream/:videoId` | Obter URL de streaming |

## Exemplo de Request/Response

### Upload de Filme

**Request:**
```http
POST /admin/movie
Content-Type: multipart/form-data

video: [arquivo.mp4]
thumbnail: [thumbnail.jpg]
title: "Meu Filme"
description: "Descrição do filme"
```

**Response:**
```json
{
  "id": "uuid-content-id",
  "title": "Meu Filme",
  "description": "Descrição do filme",
  "url": "./uploads/1234567890-uuid.mp4",
  "thumbnailUrl": "./uploads/1234567890-uuid.jpg",
  "sizeInKb": 1048576,
  "duration": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

## Serviços Principais

| Serviço | Responsabilidade |
|---------|------------------|
| `CreateMovieUseCase` | Orquestra criação de filme |
| `CreateTvShowUseCase` | Orquestra criação de série |
| `CreateTvShowEpisodeUseCase` | Adiciona episódio a série |
| `VideoProcessorService` | Dispara jobs de processamento |
| `TranscribeVideoUseCase` | Gera transcrição via IA |
| `GenerateSummaryForVideoUseCase` | Gera resumo via IA |
| `SetAgeRecommendationUseCase` | Determina classificação etária |
| `GetStreamingUrlUseCase` | Gera URL de streaming |

## Adapters (Integrações)

O módulo usa o padrão Adapter para integrações externas:

| Adapter | Responsabilidade |
|---------|------------------|
| `VideoTranscriptGenerationAdapter` | Geração de transcrição (Gemini) |
| `VideoSummaryGenerationAdapter` | Geração de resumo (Gemini) |
| `VideoAgeRecommendationAdapter` | Classificação etária (Gemini) |

## Tratamento de Erros nos Workers

Cada worker implementa:
- `onFailed`: Callback para jobs que falharam
- `onApplicationShutdown`: Graceful shutdown do worker
- Logs estruturados para debugging

```typescript
@OnWorkerEvent('failed')
onFailed(job: Job, error: Error) {
  this.logger.error(`Job failed: ${job.id}`, { job, error });
  // Opções: notificar, enviar para DLQ, retry manual
}
```

## Documentação Relacionada

- [Architecture Guidelines](../../../docs/ARCHITECTURE-GUIDELINES.md)
- [Modular Architecture Principles](../../../docs/MODULAR-ARCHITECTURE-PRINCIPLES.md)
- [Billing Module](../billing/README.md)


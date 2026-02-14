# Jon's Coffee - AI Voice Cashier

An AI-powered ordering system for NYC Coffee, a busy New York City coffee shop. Built with Next.js, OpenAI, Supabase, and ElevenLabs.

**Live Demo:** [Deployed URL]

## Features

### Customer View - AI Voice Cashier
- **Voice ordering** via OpenAI Whisper speech-to-text
- **Text-to-speech** responses via ElevenLabs (with browser fallback)
- **Text chat** toggle for quiet ordering
- Multi-turn conversational ordering with GPT-4o
- Smart menu rules enforcement (no hot Frappuccinos, shot limits, etc.)
- Automatic order receipt generation

### Barista View - Order Ticket Queue
- Real-time order ticket display (polls every 5s)
- Visual status indicators (New, In Progress, Done)
- One-click status updates
- Drink customization details at a glance (size, temp, milk, mods)

### Owner View - Data Dashboard
- Revenue metrics and order counts
- Orders by hour chart
- 7-day revenue trend
- Popular items ranking
- Category breakdown (Coffee/Tea/Pastry)
- Top modifications tracking
- Recent orders table
- Date range filtering (Today, 7D, 30D, All)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| AI Chat | OpenAI GPT-4o |
| Speech-to-Text | OpenAI Whisper |
| Text-to-Speech | ElevenLabs (browser fallback) |
| Charts | Recharts |
| Hosting | Railway |

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/jons-coffee.git
cd jons-coffee
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run:

```sql
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL,
  customer_name TEXT DEFAULT 'Guest',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

3. Copy your project URL and anon key from Project Settings > API

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in your credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key (optional)
ELEVENLABS_VOICE_ID=your_voice_id (optional)
```

### 4. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Connect your GitHub repo
4. Add environment variables in Railway dashboard
5. Railway will auto-detect Next.js and deploy

## Menu

NYC Coffee serves:
- **Coffee:** Americano, Latte, Cold Brew, Mocha, Coffee Frappuccino
- **Tea:** Black Tea, Jasmine Tea, Lemon Green Tea, Matcha Latte
- **Pastries:** Croissants, Cookie, Banana Bread
- **Add-ons:** Milk subs, extra shots, syrups
- **Customizations:** Sweetness & ice levels

## Data Structure

See `orders.csv` for sample order data structure.

## License

MIT

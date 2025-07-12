
import type { Metadata, ResolvingMetadata } from 'next';
import { getListByShareId } from "@/lib/firebase";
import SharePageClient from '@/components/SharePageClient';

type Props = {
  params: { shareId: string };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const shareId = params.shareId;
  const list = await getListByShareId(shareId);

  if (!list) {
    return {
      title: 'Shared List Not Found - Listify',
      description: 'The list you are trying to access is not available.',
    };
  }

  const listTitle = list.title || 'Untitled List';
  const title = `Shared List: ${listTitle} - Listify`;
  const description = `You've been invited to view and collaboratively edit the list "${listTitle}" on Listify. Click to see the details and make changes.`;
  const previousImages = (await parent).openGraph?.images || [];
  const pageUrl = `/share/${shareId}`;


  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'website',
      url: pageUrl, 
      images: [
        {
          url: 'https://placehold.co/1200x630.png?text=Listify+Shared+List', 
          width: 1200,
          height: 630,
          alt: 'Listify - Shared List',
        },
        ...previousImages,
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: ['https://placehold.co/1200x630.png?text=Listify+Shared+List'], 
    },
  };
}


export default function SharedListPage() {
  return <SharePageClient />;
}

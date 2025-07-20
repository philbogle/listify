
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: 'Privacy Policy - Listify',
  description: 'Privacy Policy for the Listify application.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-muted/40">
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold tracking-tight">Privacy Policy for Listify</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: September 1, 2024</p>
          </CardHeader>
          <CardContent className="prose prose-stone dark:prose-invert max-w-none text-card-foreground space-y-6">
            <p>
              Welcome to Listify. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our web application.
            </p>

            <section>
              <h2 className="text-xl font-semibold">Information We Collect</h2>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong>Personal Data (if you sign in):</strong> When you choose to sign in with Google, we use Firebase Authentication to manage your session. We receive your basic profile information from Google, such as your name and email address, to identify you within the application.
                </li>
                <li>
                  <strong>List Data:</strong> We store the content of the lists you create, including titles and individual list items. This information is stored so that you can access it across your devices.
                </li>
                <li>
                  <strong>Data for AI Processing:</strong> When you use features like "Scan," "Dictate or Paste," or "Autogenerate," the image or text data you provide is sent to Google's AI models (Gemini) for processing. This data is used solely to generate a response for you and is not stored or retained by our service after the processing is complete. Google's privacy policy governs the use of data sent to their AI services.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">How We Use Your Information</h2>
              <p>We use the information we collect solely for the following purposes:</p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>To provide and maintain the core functionality of the Listify application.</li>
                <li>To save and sync your lists across your devices when you are signed in.</li>
                <li>To enable collaborative features on lists you choose to share publicly.</li>
                <li>To process your images and text with AI to generate lists and list items as requested.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Sharing Your Information</h2>
              <p className="font-bold">
                We do not sell, trade, or otherwise share your personal information or your list content with outside parties.
              </p>
              <p>
                The only exception is the data sent to Google for AI processing as described above, which is a necessary part of providing the AI-powered features.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Data Retention</h2>
              <p>
                We retain your list information only for the purpose of making it available to you. If you delete a list or your account, the associated data is removed from our database. If you use the app without signing in, your data is stored only in your local browser storage and is not transmitted to our servers.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl font-semibold">Data Security</h2>
              <p>
                We use Firebase, a platform by Google, for our database and authentication needs, which provides robust security measures to protect your data. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee its absolute security.
              </p>
            </section>

             <section>
              <h2 className="text-xl font-semibold">Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:philbogle@gmail.com" className="text-primary underline hover:text-primary/80">philbogle@gmail.com</a>
              </p>
            </section>
            
            <div className="pt-6 text-center">
              <Button asChild variant="outline">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

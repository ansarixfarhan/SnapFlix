"use client";

import useBreakpoints from "@/hooks/useBreakpoints";
import { Accordion, AccordionItem } from "@heroui/react";

const FAQS = [
  {
    title: "🤔 What is SnapFlix?",
    description:
      "SnapFlix is a private streaming catalog platform designed to help you discover and watch movies and TV shows effortlessly, with an immersive Netflix-inspired viewing experience.",
  },
  {
    title: "❓ So what do we actually do?",
    description:
      "Well, let me tell you what we don’t do: we definitely don’t illegally host our files. We do not store any copyright-protected content on our website. Any linked content is stored only in third-party websites. This is a promotional website only. All files placed here are for introducing purpose. We highly ENCOURAGE users to BUY the CDs or DVDs of the movie or the music they like.",
  },
  {
    title: "✨ Are there any ads or popups on SnapFlix?",
    description:
      "No! SnapFlix is completely ad-free. Our custom native web player streams directly without any third-party ad popups, redirects, or banners for an uninterrupted, cinematic viewing experience.",
  },
  {
    title: "🐌 Streaming speed is slow or all videos do not play",
    description:
      "When you go on the page with the episode, in 99% of the cases there is a video player. What you have to do is click the Play button, of course. If it does not work (Don’t be judgmental! Everybody makes mistakes!), just click on the Servers you see on the top right of your device. You will get a list of servers [Vidlink, VidSrc etc.] Try choosing different server, it will definitely solve the problem.",
  },
  {
    title: "😁 I want to download video",
    description:
      "Since we don't store any files, so we don't have any download feature here. All files found on this site have been collected from various sources across the web and are believed to be in the public domain.",
  },
  {
    title: "😟 Is it safe to stream in this website?",
    description:
      "This website is undoubtedly safer to stream, however downloading, uploading is illegal. You will not get into any trouble while using our website. It's highly not recommended to download the files and share them to the public, It might get you in trouble.",
  },
];

const FAQ = () => {
  const { mobile } = useBreakpoints();

  return (
    <Accordion
      variant="splitted"
      isCompact={mobile}
      className="px-0"
      itemClasses={{
        base: "bg-[#161618] border border-white/8 shadow-none px-1",
        title: "text-sm font-semibold text-white md:text-base",
        content: "text-sm leading-relaxed text-zinc-400 pb-4",
        trigger: "py-4",
        indicator: "text-zinc-400",
      }}
    >
      {FAQS.map(({ title, description }) => (
        <AccordionItem key={title} aria-label={title} title={title}>
          {description}
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default FAQ;

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { HeartPulse, GraduationCap, HeartHandshake, ShieldCheck, Phone, Info, Utensils } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header Section */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 mb-2">
          <Info size={32} />
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">About AICS</h1>
        <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto text-sm leading-relaxed">
          The Assistance to Individuals in Crisis Situation (AICS) serves as a social safety net or a stop-gap measure to support the recovery of individuals and families suffering from unexpected life events or crises.
        </p>
      </div>

      {/* Hero Section */}
      <div className="card overflow-hidden border-0 shadow-2xl bg-slate-900 relative">
        <div className="absolute inset-0 bg-[url('/images/bg_community_service.png')] bg-cover bg-center opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent z-0" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl" />
        
        <div className="grid md:grid-cols-2 items-center gap-8 p-8 md:p-12 relative z-10 text-white">
          <div className="space-y-4">
            <h2 className="text-2xl md:text-4xl font-black leading-tight drop-shadow-sm">
              Empowering Communities, <br className="hidden sm:block" /> 
              One Family at a Time
            </h2>
            <p className="text-blue-100/90 text-sm md:text-base leading-relaxed font-medium">
              Our dedicated team of social workers and support staff work tirelessly to process requests, verify information, and ensure that those in critical need receive timely assistance. We believe in providing compassionate, transparent, and efficient public service.
            </p>
            <div className="pt-4">
              <Link href="/requests/new" className="inline-flex items-center gap-2 bg-white text-blue-700 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors shadow-lg">
                <HeartHandshake size={18} /> Apply for Assistance
              </Link>
            </div>
          </div>
          <div className="relative h-64 md:h-full min-h-[250px] w-full rounded-2xl overflow-hidden border-4 border-white/20 shadow-2xl">
            <Image 
              src="/about/hero.png" 
              alt="AICS Staff helping community" 
              fill 
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="space-y-6 pt-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Our Core Services</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Providing targeted support for various crisis situations</p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <div className="card p-6 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <HeartPulse size={24} />
            </div>
            <h3 className="font-bold text-lg text-[var(--color-text)] mb-2">Medical Assistance</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Financial support to help defray costs of hospitalization, medicines, and medical treatment or procedures. We aim to ease the burden of healthcare costs during emergencies.
            </p>
          </div>

          <div className="card p-6 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center mb-4">
              <ShieldCheck size={24} />
            </div>
            <h3 className="font-bold text-lg text-[var(--color-text)] mb-2">Burial Assistance</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Aid provided to families experiencing the loss of a loved one. This helps cover funeral costs, casket, and related expenses to provide a dignified farewell.
            </p>
          </div>

          <div className="card p-6 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <GraduationCap size={24} />
            </div>
            <h3 className="font-bold text-lg text-[var(--color-text)] mb-2">Educational Support</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Financial aid for eligible students to help cover school supplies, transportation, and other educational necessities, ensuring continuous learning despite crises.
            </p>
          </div>

          <div className="card p-6 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Utensils size={24} />
            </div>
            <h3 className="font-bold text-lg text-[var(--color-text)] mb-2">Food Assistance</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Provision of food packs or financial aid to alleviate hunger for families experiencing sudden emergencies, disasters, or prolonged crises.
            </p>
          </div>
        </div>
      </div>

      {/* Staff Role & Vector Image */}
      <div className="grid md:grid-cols-2 gap-8 items-center pt-8">
        <div className="order-2 md:order-1 relative h-72 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Image 
            src="/about/services.png" 
            alt="AICS Services Illustration" 
            fill 
            className="object-contain p-6"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        <div className="order-1 md:order-2 space-y-4">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">The Role of AICS Staff</h2>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
            Our staff operates as the crucial bridge between government resources and the individuals who need them most. From the moment you walk through our doors or submit an application online, our dedicated encoders, social workers, and administrators work collaboratively to process your request.
          </p>
          <ul className="space-y-3 mt-4">
            {[
              "Thorough assessment of beneficiary needs",
              "Verification of required documents to ensure fairness",
              "Rapid processing of payouts during critical emergencies",
              "Continuous monitoring and support for recurring beneficiaries"
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[var(--color-text)]">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Contact Section */}
      <div className="mt-12 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-8 text-center max-w-3xl mx-auto">
        <Phone size={32} className="mx-auto text-blue-500 mb-4" />
        <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">Need Help or Have Questions?</h3>
        <p className="text-[var(--color-text-secondary)] text-sm mb-6 max-w-md mx-auto">
          If you have questions about your application, the required documents, or want to know more about the AICS program, we are here for you.
        </p>
        <button className="btn btn-primary px-8" onClick={() => window.alert('Contact the MSWD office at (032) 123-4567')}>
          Contact Us
        </button>
      </div>
    </div>
  )
}

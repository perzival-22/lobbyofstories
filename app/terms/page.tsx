import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Terms & Conditions — Lobby of Stories',
  description: 'Terms and Conditions governing the use of Lobby of Stories.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      <SiteHeader />

      <main className="px-8 py-16 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--gold)' }}>
            Legal
          </p>
          <h1
            className="text-4xl mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Terms &amp; Conditions
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Effective date: 4 June 2026 &nbsp;·&nbsp; Last updated: 4 June 2026
          </p>
        </div>

        <div
          className="prose max-w-none text-sm leading-relaxed space-y-10"
          style={{ color: 'var(--paper)' }}
        >
          {/* 1 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              1. Agreement to These Terms
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Welcome to <strong style={{ color: 'var(--paper)' }}>Lobby of Stories</strong> ("the
              Platform", "we", "us", or "our"), a personal digital library of original serialized
              fiction. By accessing or using this Platform in any way — including browsing, creating
              an account, or reading any content — you ("User", "you") agree to be bound by these
              Terms &amp; Conditions ("Terms") in full. If you do not agree, you must immediately
              stop using the Platform.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              These Terms constitute a legally binding agreement between you and the owner and
              operator of Lobby of Stories. We reserve the right to update these Terms at any time.
              Continued use of the Platform after changes are posted constitutes your acceptance of
              the revised Terms.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              2. Intellectual Property &amp; Copyright
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              All stories, narratives, characters, plot lines, world-building elements, scene
              descriptions, episode titles, prose, and any other written content published on this
              Platform (collectively, "Content") are original works authored solely by the Platform
              owner and are protected by copyright law. All rights are reserved.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              The Platform name, logo, design, layout, and visual identity are likewise the exclusive
              property of the Platform owner.
            </p>

            <h3
              className="text-base mt-5 mb-2"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--paper)' }}
            >
              You may NOT:
            </h3>
            <ul className="list-disc list-inside space-y-2" style={{ color: 'var(--muted)' }}>
              <li>Copy, reproduce, or duplicate any Content in whole or in part.</li>
              <li>
                Republish, redistribute, or re-upload any Content to any third-party website,
                platform, app, newsletter, or print publication.
              </li>
              <li>
                Sell, license, sublicense, rent, or otherwise commercialize any Content for personal
                or business gain.
              </li>
              <li>
                Translate, adapt, create derivative works, fan-fiction, or other modifications of
                the Content and distribute them without prior written permission.
              </li>
              <li>
                Use any Content to train, fine-tune, or augment artificial intelligence or machine
                learning models, including but not limited to large language models (LLMs).
              </li>
              <li>
                Scrape, crawl, index, or harvest any Content using automated tools, bots, or
                scripts.
              </li>
              <li>
                Remove, alter, or obscure any copyright notices, author attributions, or proprietary
                notices.
              </li>
            </ul>

            <h3
              className="text-base mt-5 mb-2"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--paper)' }}
            >
              You may:
            </h3>
            <ul className="list-disc list-inside space-y-2" style={{ color: 'var(--muted)' }}>
              <li>Read Content on the Platform for your own personal, non-commercial enjoyment.</li>
              <li>
                Share a direct link to a story or chapter page (the URL only) on social media or
                with friends, provided no Content is reproduced in the share.
              </li>
              <li>
                Quote brief excerpts (no more than two sentences) for the sole purpose of
                recommending the work, provided the Platform and the author are clearly credited.
              </li>
            </ul>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              Any use not expressly permitted above requires prior written consent from the Platform
              owner. To request permission, contact us at{' '}
              <a
                href="mailto:kelvinmusiomi99@gmail.com"
                style={{ color: 'var(--gold)' }}
              >
                kelvinmusiomi99@gmail.com
              </a>
              .
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              3. Limited Reading Licence
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Subject to these Terms, we grant you a limited, personal, non-exclusive,
              non-transferable, revocable licence to access and read the Content through the
              Platform's standard reading interface for your own private, non-commercial use.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              This licence does not constitute a transfer of any intellectual property rights. All
              rights not expressly granted in these Terms are reserved by the Platform owner.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              4. User Accounts
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Creating an account is free and optional. An account unlocks reading progress tracking
              (scroll position and chapter completion). Account registration and authentication are
              handled by Clerk, a third-party identity service. By creating an account, you also
              agree to Clerk's Terms of Service and Privacy Policy.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              You are responsible for:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-2" style={{ color: 'var(--muted)' }}>
              <li>
                Providing accurate information during registration and keeping it up to date.
              </li>
              <li>Maintaining the confidentiality of your login credentials.</li>
              <li>
                All activity that occurs under your account, whether or not authorised by you.
              </li>
            </ul>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              We reserve the right to suspend or permanently delete any account at our sole
              discretion, without prior notice, if we believe you have violated these Terms or engaged
              in any conduct harmful to the Platform or its Content.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              You may delete your account at any time through your account settings. Deletion
              permanently removes all stored reading progress data associated with your account.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              5. Data Collection &amp; Privacy
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              We collect and store the minimum data necessary to operate the Platform:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-2" style={{ color: 'var(--muted)' }}>
              <li>
                <strong style={{ color: 'var(--paper)' }}>Account data:</strong> Your email address
                and a unique identifier provided by Clerk upon registration.
              </li>
              <li>
                <strong style={{ color: 'var(--paper)' }}>Reading progress:</strong> Per-chapter
                scroll position and completion status, linked to your account, so you can resume
                reading where you left off.
              </li>
            </ul>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              We do not sell, rent, or share your personal data with third parties for marketing
              purposes. Data is stored securely on Vercel-managed infrastructure. By using the
              Platform, you consent to this data collection and storage as described.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              Guests who browse without an account do not have any personal data stored by us beyond
              what is standard for server log files (e.g., IP address, browser type), which we do not
              actively process or retain.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              6. Acceptable Use
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              When using the Platform, you agree not to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-2" style={{ color: 'var(--muted)' }}>
              <li>
                Attempt to gain unauthorized access to any part of the Platform, including
                administrative areas, databases, or server infrastructure.
              </li>
              <li>
                Interfere with or disrupt the integrity, availability, or performance of the Platform
                or its servers (including but not limited to denial-of-service attacks).
              </li>
              <li>
                Reverse engineer, decompile, or disassemble any part of the Platform's software.
              </li>
              <li>
                Use the Platform for any unlawful purpose or in any manner that violates applicable
                local, national, or international law.
              </li>
              <li>
                Impersonate the Platform owner, its staff, or any other person.
              </li>
              <li>
                Use automated means (bots, scrapers, crawlers) to access, download, or index Content.
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              7. No User-Generated Content
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              The Platform does not currently support user-generated content submission (comments,
              reviews, uploads, or similar). All published Content is exclusively authored and
              uploaded by the Platform owner. Should this change in the future, these Terms will be
              updated accordingly.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              8. Availability &amp; Modifications
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              We provide the Platform on an "as is" and "as available" basis. We do not guarantee
              that the Platform will be uninterrupted, error-free, or free from technical issues. We
              reserve the right to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-2" style={{ color: 'var(--muted)' }}>
              <li>Modify, suspend, or discontinue the Platform or any feature at any time.</li>
              <li>
                Add, edit, remove, or unpublish any story, chapter, or piece of Content at our sole
                discretion.
              </li>
              <li>Change these Terms at any time, with the updated date reflected above.</li>
            </ul>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              We will make reasonable efforts to notify users of significant changes, but this is not
              guaranteed. It is your responsibility to review these Terms periodically.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              9. Disclaimer of Warranties
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              To the fullest extent permitted by law, the Platform and all its Content are provided
              without any warranties, express or implied, including but not limited to warranties of
              merchantability, fitness for a particular purpose, or non-infringement. We do not
              warrant that the Platform is free from viruses, harmful components, or other
              technologically harmful material.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              10. Limitation of Liability
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              To the maximum extent permitted by applicable law, the Platform owner shall not be
              liable for any indirect, incidental, special, consequential, or punitive damages
              arising out of or in connection with your use of, or inability to use, the Platform or
              its Content — including loss of data or loss of profits — even if we have been advised
              of the possibility of such damages.
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              Our total liability to you for any claim arising under these Terms shall not exceed the
              amount you have paid to access the Platform (which, as the Platform is currently free,
              is zero).
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              11. Third-Party Services
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              The Platform uses the following third-party services to function:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-2" style={{ color: 'var(--muted)' }}>
              <li>
                <strong style={{ color: 'var(--paper)' }}>Clerk</strong> — authentication and user
                identity management.
              </li>
              <li>
                <strong style={{ color: 'var(--paper)' }}>Vercel</strong> — hosting and
                infrastructure.
              </li>
              <li>
                <strong style={{ color: 'var(--paper)' }}>Neon (PostgreSQL)</strong> — database
                storage.
              </li>
              <li>
                <strong style={{ color: 'var(--paper)' }}>Vercel Blob</strong> — cover image
                storage via a public content delivery network (CDN).
              </li>
            </ul>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              We are not responsible for the practices, privacy policies, or terms of any
              third-party services. Your use of those services is governed by their own respective
              terms.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              12. Enforcement &amp; Violations
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              We take copyright infringement seriously. If you become aware of any Content from this
              Platform being reproduced, distributed, or used without authorization, please report it
              to{' '}
              <a href="mailto:kelvinmusiomi99@gmail.com" style={{ color: 'var(--gold)' }}>
                kelvinmusiomi99@gmail.com
              </a>
              .
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              Violation of these Terms — particularly the intellectual property provisions — may
              result in immediate account termination, legal action including claims for damages and
              injunctive relief, or both.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              13. Severability
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              If any provision of these Terms is found to be unlawful, void, or unenforceable, that
              provision shall be deemed severable from these Terms and shall not affect the validity
              and enforceability of the remaining provisions.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2
              className="text-lg mb-3 tracking-wide"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--gold)' }}
            >
              14. Contact
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              If you have any questions, concerns, or requests regarding these Terms, please reach
              out:
            </p>
            <p className="mt-3" style={{ color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--paper)' }}>Lobby of Stories</strong>
              <br />
              Email:{' '}
              <a href="mailto:kelvinmusiomi99@gmail.com" style={{ color: 'var(--gold)' }}>
                kelvinmusiomi99@gmail.com
              </a>
            </p>
          </section>

          {/* Closing */}
          <div
            className="pt-8 text-center text-xs tracking-widest uppercase"
            style={{ color: 'var(--muted)', borderTop: '1px solid #2a2520' }}
          >
            By using Lobby of Stories, you acknowledge that you have read, understood, and agree to
            these Terms &amp; Conditions.
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

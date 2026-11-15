from app.infrastructure.orm import StudentDocumentORM, UserORM


def test_home_stats_are_public(client):
    response = client.get("/home/stats")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_placements"] > 0
    assert body["total_organizations"] > 0
    assert set(body["org_counts"]) == {"Company", "Government", "NGO", "University"}


def test_public_testimonials_return_verified_text_without_auth(client, session):
    owner = session.query(UserORM).filter_by(email="amina@makerere.ac.ug").one()
    session.add_all(
        [
            StudentDocumentORM(
                id="public-testimonial",
                user_id=owner.id,
                document_type="testimonial",
                filename="testimonial.txt",
                content_type="text/plain",
                size_bytes=82,
                content=(
                    b"Testimonial for a current placement\n\n"
                    b"Supervisor: Amina\nRole: Designer\n\n"
                    b"I learned how to ship accessible products."
                ),
                status="verified",
                uploaded_at="2026-11-01T10:00:00",
                is_public=True,
                author_role="student",
                author_id=owner.id,
            ),
            StudentDocumentORM(
                id="pending-testimonial",
                user_id=owner.id,
                document_type="testimonial",
                filename="pending.txt",
                content_type="text/plain",
                size_bytes=7,
                content=b"Pending",
                status="pending",
                uploaded_at="2026-11-02T10:00:00",
                is_public=True,
                author_role="student",
                author_id=owner.id,
            ),
        ]
    )
    session.commit()

    response = client.get("/admin/testimonials")

    assert response.status_code == 200, response.text
    assert response.json() == [
        {
            "id": "public-testimonial",
            "author_role": "student",
            "uploaded_at": "2026-11-01T10:00:00",
            "testimonial_text": (
                "Testimonial for a current placement\n\n"
                "Supervisor: Amina\nRole: Designer\n\n"
                "I learned how to ship accessible products."
            ),
        }
    ]
